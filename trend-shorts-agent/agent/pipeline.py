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


def step_research(ctx: RunContext, force: bool = False):
    if ctx.step_done("researched") and not force:
        log.info("조사: 이미 완료 → 건너뜀")
        return None
    from .analysis.research import research
    with timed("research"):
        return research(ctx)


def step_write(ctx: RunContext, force: bool = False):
    if ctx.step_done("checked") and not force:
        log.info("대본·팩트체크: 이미 완료 → 건너뜀")
        return None
    from .writing.fact_checker import fact_check
    from .writing.script_writer import write
    if force or not ctx.step_done("scripted"):
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


def run_daily(run_date: str | None = None, force: bool = False, produce_auto: bool = True, settings=None) -> str:
    ctx = RunContext(run_date, settings)
    try:
        step_collect(ctx, force)
        step_cluster(ctx, force)
        step_research(ctx, force)
        step_write(ctx, force)
        _, approved = step_shortlist(ctx)
        ctx.finish()
        log.info("run %s 완료 — 비용 $%.2f, 쿼터 %d", ctx.run_date, ctx.run.cost_usd, ctx.run.quota_used)
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
