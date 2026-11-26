"""전체 파이프라인 오케스트레이션 (단계별 멱등 실행, --force 로 강제)."""
from __future__ import annotations

import logging

from sqlalchemy import select

from .context import RunContext
from .costs import BudgetExceeded
from .logging_setup import timed
from .models import Run, Script, Topic
from .notify import notify

log = logging.getLogger(__name__)


def step_collect(ctx: RunContext, force: bool = False, client=None):
    if ctx.step_done("collected") and not force:
        log.info("수집: 이미 완료 → 건너뜀")
        return ctx.read_json("videos.json")
    from .collectors.youtube import collect
    with timed("collect"):
        return collect(ctx, client)


def step_cluster(ctx: RunContext, force: bool = False):
    if ctx.step_done("clustered") and not force:
        log.info("클러스터링: 이미 완료 → 건너뜀")
        return ctx.read_json("topics.json")
    from .analysis.clustering import cluster
    with timed("cluster"):
        return cluster(ctx)


def _requeue_failed(ctx: RunContext) -> int:
    """앞선 실행에서 일시적 오류로 실패한 주제를 실패한 단계부터 다시 하도록 되돌린다."""
    n = 0
    for t in ctx.session.scalars(select(Topic).where(Topic.run_id == ctx.run.id, Topic.status == "failed")):
        if not t.research:
            continue  # 조사 단계 실패 → step_research 가 직접 다시 시도
        t.status = "scripted" if t.scripts else "researched"
        n += 1
    if n:
        ctx.session.commit()
        log.info("이전에 실패한 주제 %d개를 다시 시도합니다", n)
    return n


def _failed_research(ctx: RunContext) -> bool:
    # JSON 컬럼의 None 은 SQL NULL 이 아니라 'null' 로 저장될 수 있어 파이썬에서 판정
    return any(not t.research for t in ctx.session.scalars(
        select(Topic).where(Topic.run_id == ctx.run.id, Topic.status == "failed")))


def step_research(ctx: RunContext, force: bool = False):
    if ctx.step_done("researched") and not force and _failed_research(ctx):
        log.info("조사: 이전에 실패한 주제만 다시 시도")
    elif ctx.step_done("researched") and not force:
        log.info("조사: 이미 완료 → 건너뜀")
        return None
    from .analysis.research import research
    with timed("research"):
        return research(ctx)


def step_write(ctx: RunContext, force: bool = False):
    _requeue_failed(ctx)
    if ctx.step_done("checked") and not force and not ctx.session.scalar(
            select(Topic.id).where(Topic.run_id == ctx.run.id, Topic.status.in_(["researched", "scripted"])).limit(1)):
        log.info("대본·팩트체크: 이미 완료 → 건너뜀")
        return None
    from .writing.fact_checker import fact_check
    from .writing.script_writer import write
    pending = lambda st: ctx.session.scalar(select(Topic.id).where(  # noqa: E731
        Topic.run_id == ctx.run.id, Topic.status == st).limit(1)) is not None
    if force or not ctx.step_done("scripted") or pending("researched"):
        if force:  # 재작성 대상 되돌리기
            for t in ctx.session.scalars(select(Topic).where(Topic.run_id == ctx.run.id,
                                                             Topic.status.in_(["scripted", "checked"]))):
                t.status = "researched"
        with timed("write"):
            write(ctx)
    with timed("fact_check"):
        return fact_check(ctx)


def step_shortlist(ctx: RunContext):
    from .review.actions import auto_approve, candidates, write_shortlist
    s = ctx.settings
    approved = []
    if not s.review.require_approval:
        approved = auto_approve(ctx.session, ctx.run_date, s.review.auto_produce_top_n)
    path = write_shortlist(ctx)
    ctx.set_status("pending_review")
    n = len(candidates(ctx.session, ctx.run_date))
    msg = f"📋 {ctx.run_date} 오늘의 숏폼 후보 {n}개 — 검토: python -m agent review\n{path}"
    if approved:
        msg += f"\n자동 승인 {len(approved)}개"
    notify(msg, s.notify.enabled)
    return path, approved


def funnel(ctx: RunContext) -> dict:
    """단계별 결과 개수 (후보가 0개일 때 어디서 줄었는지 보기 위함)."""
    def _len(name):
        try:
            return len(ctx.read_json(name))
        except (FileNotFoundError, ValueError):
            return None
    topics = list(ctx.session.scalars(select(Topic).where(Topic.run_id == ctx.run.id)))
    from collections import Counter
    st = Counter(t.status for t in topics)
    from .review.actions import candidates
    return {"videos": _len("videos.json"), "topics": len(topics), "excluded": _len("topics_excluded.json"),
            "researched_ok": sum(1 for t in topics if t.research),
            "failed": st.get("failed", 0), "candidates": len(candidates(ctx.session, ctx.run_date)),
            "status": dict(st)}


def diagnose(f: dict, settings) -> str:
    c = settings.collect
    lines = [f"수집 영상 {f['videos']}개 → 주제 {f['topics']}개 (제외 {f['excluded'] or 0}개) → 조사 성공 {f['researched_ok']}개"
             f" → 실패 {f['failed']}개 → 검토 후보 {f['candidates']}개"]
    if f["candidates"]:
        lines.append("다음 단계: ✅ 후보 검토에서 승인 → 🏠 홈의 [승인된 영상 제작] 버튼을 누르면 영상이 만들어집니다.")
    elif not f["videos"]:
        lines.append(f"원인: 조건(최근 {c.published_within_hours}시간·조회수 {c.min_view_count:,}회 이상)에 맞는 영상이 없습니다. "
                     "설정에서 조회수 기준을 낮추거나 카테고리를 비워 보세요.")
    elif not f["topics"]:
        lines.append("원인: 영상은 모았지만 주제 묶기 결과가 0개입니다 (모두 제외됐거나 AI 응답 문제). "
                     "다시 실행하면 주제 묶기를 자동으로 다시 시도합니다.")
    elif f["failed"]:
        lines.append("원인: 조사·대본 단계가 실패했습니다 (구글 서버 혼잡 등). 10~30분 뒤 다시 실행하면 실패한 주제만 이어서 합니다.")
    return "\n".join(lines)


def run_daily(run_date: str | None = None, force: bool = False, produce_auto: bool = True, settings=None) -> str:
    ctx = RunContext(run_date, settings)
    try:
        videos = step_collect(ctx, force)
        topics = step_cluster(ctx, force)
        if videos and not topics and not force:  # 지난번 주제 묶기가 0개 → 한 번 다시 (Gemini 무료라 비용 없음)
            log.info("지난 실행의 주제가 0개였습니다 → 주제 묶기를 다시 시도합니다")
            step_cluster(ctx, force=True)
        step_research(ctx, force)
        step_write(ctx, force)
        _, approved = step_shortlist(ctx)
        ctx.finish()
        summary = diagnose(funnel(ctx), ctx.settings)
        (ctx.run_dir / "summary.txt").write_text(summary, encoding="utf-8")
        log.info("run %s 완료 — 비용 $%.2f, 쿼터 %d\n%s", ctx.run_date, ctx.run.cost_usd, ctx.run.quota_used, summary)
    except BudgetExceeded as e:
        ctx.finish(str(e))
        notify(f"⛔ {ctx.run_date} 실행 중단: {e}", ctx.settings.notify.enabled)
        raise
    except Exception as e:
        ctx.finish(f"{type(e).__name__}: {e}")
        notify(f"⚠️ {ctx.run_date} 실행 실패: {e}", ctx.settings.notify.enabled)
        raise
    finally:
        ctx.close()
    if approved and produce_auto:
        produce_approved(settings=settings)
    return ctx.run_date


def _ctx_for_script(script: Script, settings=None) -> RunContext:
    return RunContext(script.topic.run.date, settings)


def produce(script_id: int, settings=None, tts=None, stock_search=None, force: bool = False):
    from .models import session_scope
    from .config import get_settings
    from .production.producer import produce_script
    st = settings or get_settings()
    lookup = session_scope(st.db_url)
    script = lookup.get(Script, script_id)
    if script is None:
        raise LookupError(f"script {script_id} 없음")
    if script.approval_status != "approved" and not (force and script.approval_status in ("produced", "approved")):
        raise PermissionError(f"script {script_id} 는 승인되지 않았습니다 (상태: {script.approval_status})")
    ctx = _ctx_for_script(script, st)
    try:
        row = ctx.session.get(Script, script_id)
        from . import __version__
        log.info("프로그램 버전 %s", __version__)
        with timed(f"produce script {script_id}"):
            return produce_script(ctx, row, tts=tts, stock_search=stock_search)
    finally:
        ctx.close()
        lookup.close()


def produce_approved(settings=None, **kw):
    from .config import get_settings
    from .models import session_scope
    st = settings or get_settings()
    s = session_scope(st.db_url)
    ids = list(s.scalars(select(Script.id).where(Script.approval_status == "approved").order_by(Script.id)))
    s.close()
    results = []
    for sid in ids:
        try:
            results.append(produce(sid, settings=st, **kw))
        except BudgetExceeded:
            raise
        except Exception:
            log.exception("script %d 제작 실패", sid)
    return results


def latest_run_date(settings) -> str | None:
    from .models import session_scope
    s = session_scope(settings.db_url)
    d = s.scalar(select(Run.date).order_by(Run.date.desc()))
    s.close()
    return d


def today_runs(session, day: str) -> list:
    """오늘 실행들 (첫 실행 'YYYY-MM-DD', 추가 실행 'YYYY-MM-DD-2' …), 최근 것 먼저."""
    return list(session.scalars(select(Run).where((Run.date == day) | Run.date.like(f"{day}-%"))
                                .order_by(Run.id.desc())))


def next_batch(settings, kids: bool = False, profile: str | None = None) -> str:
    """같은 날 새로 한 번 더 돌릴 때 쓸 실행 이름. 어린이용은 'YYYY-MM-DD-kids', '-kids-2' …"""
    from .context import today
    from .models import session_scope
    day = today(settings)
    s = session_scope(settings.db_url)
    try:
        names = {r.date for r in today_runs(s, day)}
    finally:
        s.close()
    profile = profile or ("kids" if kids else "general")
    base = day if profile == "general" else f"{day}-{profile}"
    if base not in names:
        return base
    n = 2
    while f"{base}-{n}" in names:
        n += 1
    return f"{base}-{n}"
