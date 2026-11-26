"""CLI 진입점: python -m agent <command>"""
from __future__ import annotations

import json
import logging
import subprocess
import sys
from pathlib import Path
from typing import Optional

import typer

from .config import PROJECT_ROOT, get_settings
from .logging_setup import setup_logging

app = typer.Typer(add_completion=False, help="트렌드 숏폼 자동 제작 AI 에이전트")
log = logging.getLogger("agent")

RunOpt = typer.Option(None, "--run", help="실행 날짜 YYYY-MM-DD (기본: 오늘)")
ForceOpt = typer.Option(False, "--force", help="이미 완료된 단계도 다시 실행")


@app.callback()
def _main(verbose: bool = typer.Option(False, "-v", "--verbose")):
    setup_logging("DEBUG" if verbose else "INFO")


def _ctx(run: Optional[str]):
    from .context import RunContext
    return RunContext(run)


@app.command("run-daily")
def run_daily(run: Optional[str] = RunOpt, force: bool = ForceOpt,
              new: bool = typer.Option(False, "--new", help="같은 날 새로 한 번 더 (새 트렌드 수집, 앞에서 쓴 영상 제외)")):
    """1~6단계 전체 (수집→클러스터→조사→대본→팩트체크→후보 리스트). 제작은 승인 대기."""
    from .pipeline import next_batch, run_daily as _run
    if new:
        run = next_batch(get_settings())
        typer.echo(f"새 실행: {run}")
    d = _run(run, force)
    summary = get_settings().data_dir / "runs" / d / "summary.txt"
    if summary.exists():
        typer.echo("\n" + summary.read_text(encoding="utf-8"))
    typer.echo(f"\n후보 목록: data/runs/{d}/shortlist.md")


@app.command()
def collect(run: Optional[str] = RunOpt, force: bool = ForceOpt):
    """YouTube 트렌드 영상 수집 → videos.json"""
    from .pipeline import step_collect
    with _ctx(run) as ctx:
        vids = step_collect(ctx, force)
        typer.echo(f"{len(vids)}개 영상 → {ctx.run_dir / 'videos.json'}")


@app.command()
def cluster(run: Optional[str] = RunOpt, force: bool = ForceOpt):
    """주제 클러스터링 → topics.json"""
    from .pipeline import step_cluster
    with _ctx(run) as ctx:
        topics = step_cluster(ctx, force)
        typer.echo(f"{len(topics)}개 주제 → {ctx.run_dir / 'topics.json'}")


@app.command()
def research(run: Optional[str] = RunOpt, force: bool = ForceOpt):
    """상위 주제 웹 조사 → research/{topic_id}.json"""
    from .pipeline import step_research
    with _ctx(run) as ctx:
        step_research(ctx, force)
        typer.echo(f"조사 결과 → {ctx.run_dir / 'research'}")


@app.command()
def write(run: Optional[str] = RunOpt, force: bool = ForceOpt):
    """대본 작성 + 팩트체크 + shortlist.md"""
    from .pipeline import step_shortlist, step_write
    with _ctx(run) as ctx:
        step_write(ctx, force)
        path, _ = step_shortlist(ctx)
        typer.echo(f"후보 리스트 → {path}")


@app.command()
def review(port: int = 8501):
    """Streamlit 검토 화면 실행"""
    app_path = Path(__file__).parent / "review" / "app.py"
    subprocess.run([sys.executable, "-m", "streamlit", "run", str(app_path), "--server.port", str(port)],
                   cwd=PROJECT_ROOT)


@app.command()
def candidates(run: Optional[str] = RunOpt):
    """후보 목록 (터미널)"""
    from .context import today
    from .models import session_scope
    from .review.actions import candidates as _c
    st = get_settings()
    s = session_scope(st.db_url)
    for t, sc in _c(s, run or today(st)):
        typer.echo(f"[{sc.id:>4}] {sc.approval_status:<14} {t.score:6.1f}  {sc.est_seconds:4.0f}s  "
                   f"{','.join(sc.risk_flags or []) or '-':<20} {t.title}")


@app.command()
def decide(script_id: int, decision: str = typer.Argument(..., help="approve | reject | hold"), note: str = ""):
    """터미널에서 승인/반려/보류"""
    from .models import session_scope
    from .review.actions import decide as _d
    s = session_scope(get_settings().db_url)
    sc = _d(s, script_id, decision, note)
    typer.echo(f"script {script_id} → {sc.approval_status}")


@app.command()
def produce(script_id: Optional[int] = typer.Option(None, "--script-id"),
            approved: bool = typer.Option(False, "--approved", help="승인된 대본 전부 제작"),
            force: bool = ForceOpt):
    """승인된 대본으로 영상 제작"""
    from .pipeline import produce as _p, produce_approved
    if approved:
        res = produce_approved()
    elif script_id is not None:
        res = [_p(script_id, force=force)]
    else:
        raise typer.BadParameter("--script-id 또는 --approved 를 지정하세요")
    for p in res:
        typer.echo(f"production {p.id}: {p.status} {p.video_path or p.error or ''}")


@app.command()
def publish(production_id: int = typer.Option(..., "--production-id"), privacy: Optional[str] = None):
    """(선택) YouTube 비공개 업로드"""
    from .models import Production, session_scope
    from .publish.youtube_upload import upload
    st = get_settings()
    s = session_scope(st.db_url)
    prod = s.get(Production, production_id)
    if not prod or prod.status != "produced":
        raise typer.Exit(f"production {production_id} 은 업로드 가능한 상태가 아닙니다")
    vid = Path(prod.video_path)
    yt_id = upload(vid, vid.parent / "meta.json", privacy or st.publish.privacy)
    prod.youtube_id, prod.status = yt_id, "uploaded"
    s.commit()
    typer.echo(f"업로드 완료 (비공개): https://youtu.be/{yt_id}")
    typer.echo(f"YouTube Studio 에서 확인: https://studio.youtube.com/video/{yt_id}/edit")


@app.command("youtube-login")
def youtube_login():
    """YouTube 업로드용 구글 계정 연결 (처음 한 번, 브라우저 로그인)"""
    from .publish.youtube_upload import login
    typer.echo(f"연결 완료 — 업로드 채널: {login()}")


@app.command()
def schedule():
    """APScheduler 로 매일 settings.schedule.run_at 에 실행 (포그라운드)"""
    from .scheduler import start_scheduler
    start_scheduler()


@app.command("daily-job")
def daily_job(if_due: bool = typer.Option(False, "--if-due", help="예정 시각이 지났고 아직 안 돌았을 때만 (로그인 시 보충 실행용)")):
    """예약 작업용: 락 + 하루 1회 보장 후 run-daily"""
    from .scheduler import daily_job as _j
    d = _j(if_due=if_due)
    typer.echo(f"실행: {d}" if d else "건너뜀 (이미 실행됨/실행 중/실패 — 로그 확인)")


@app.command("app")
def control_panel(port: int = 8501, open_browser: bool = typer.Option(True, "--open/--no-open")):
    """통합 제어판 (프로그램 화면) 실행 — 준비되면 브라우저 창을 자동으로 엽니다"""
    from .ui.launcher import launch
    raise typer.Exit(launch(port, open_browser))


@app.command("schedule-install")
def schedule_install():
    """이 PC 의 예약 작업(Windows 작업 스케줄러 / crontab)에 매일 자동 실행 등록"""
    from .scheduler import install_schedule
    typer.echo(install_schedule())


@app.command("schedule-uninstall")
def schedule_uninstall():
    """자동 실행 해제"""
    from .scheduler import uninstall_schedule
    typer.echo(uninstall_schedule())


@app.command("setup-ffmpeg")
def setup_ffmpeg(force: bool = typer.Option(False, "--force")):
    """FFmpeg 가 없으면 내려받아 tools/ffmpeg 에 설치 (Windows)"""
    from .tools import find_tool, install_ffmpeg
    if find_tool("ffmpeg") and find_tool("ffprobe") and not force:
        typer.echo(f"FFmpeg 이미 있음: {find_tool('ffmpeg')}")
        return
    install_ffmpeg()
    typer.echo(f"설치 완료: {find_tool('ffmpeg')}")


@app.command("llm-test")
def llm_test():
    """AI(Gemini) 연결 테스트 — 모델마다 짧은 질문 1번, 되는 모델을 기본으로 저장"""
    from .config import save_local_settings
    from .llm_gemini import probe_models
    res = probe_models(get_settings())
    for r in res:
        typer.echo(f"{'OK ' if r['ok'] else 'X  '} {r['model']:<32} {r['status']} {r['message']}")
    good = [r["model"] for r in res if r["ok"]]
    if good:
        save_local_settings({"llm": {"gemini_model": good[0]}})
        typer.echo(f"\n→ '{good[0]}' 를 기본 모델로 저장했습니다.")


@app.command()
def doctor():
    """이 PC 에서 돌릴 준비가 됐는지 점검"""
    from .doctor import ready, run_checks
    checks = run_checks(get_settings())
    for c in checks:
        icon = "OK " if c.ok else ("X  " if c.required else "-  ")
        typer.echo(f"[{icon}] {c.name}: {c.detail}" + (f"\n       → {c.fix}" if not c.ok and c.fix else ""))
    typer.echo("\n준비 완료" if ready(checks) else "\n필수 항목이 아직 준비되지 않았습니다")


@app.command("crontab")
def crontab():
    """cron 등록용 한 줄 출력"""
    from .scheduler import crontab_line
    typer.echo(crontab_line(get_settings(), PROJECT_ROOT))


@app.command("bgm-samples")
def bgm_samples(seconds: float = 30, out: Path = typer.Option(Path("data/bgm_samples"))):
    """mood 8종 샘플 BGM WAV 생성"""
    from .production.bgm.generator import generate_bgm
    from .production.bgm.mood import MOODS
    st = get_settings()
    for i, mood in enumerate(MOODS):
        p, m = generate_bgm(mood, seconds, 1000 + i, out / mood, st.resolve(st.bgm.soundfont),
                            fade_in=st.bgm.fade_in_sec, fade_out=st.bgm.fade_out_sec)
        typer.echo(f"{mood:<10} {m['bpm']}bpm {m['key']:<9} {m['progression']:<14} → {p}")


@app.command()
def sample(tts: str = typer.Option("dummy", help="dummy | elevenlabs | google"),
           visuals: str = typer.Option("none", help="none(카드만) | all(설정의 visual_sources) | 쉼표로 소스 지정")):
    """API 키 없이 샘플 대본 1개로 전체 제작 파이프라인 시연 (Phase 5 확인용)"""
    from .context import RunContext
    from .models import Script, Topic
    from .pipeline import produce as _p
    st = get_settings().model_copy(deep=True)
    st.production.tts_provider = tts
    if visuals != "all":
        st.production.visual_sources = [] if visuals == "none" else visuals.split(",")
    script = json.loads((Path(__file__).parent / "samples" / "sample_script.json").read_text(encoding="utf-8"))
    from .writing.script_writer import normalize_script
    script = normalize_script(script, script["topic_id"], st.script.chars_per_second, set(script["sources"]))
    with RunContext("0000-sample", st) as ctx:
        topic = Topic(run_id=ctx.run.id, key=f"sample-{len(ctx.run.topics) + 1}", title=script["title"], score=0)
        ctx.session.add(topic)
        ctx.session.flush()
        row = Script(topic_id=topic.id, json=script, char_count=script["char_count"],
                     est_seconds=script["estimated_seconds"], approval_status="approved")
        ctx.session.add(row)
        ctx.session.commit()
        sid = row.id
    prod = _p(sid, settings=st)
    typer.echo(f"{prod.status}: {prod.video_path or prod.error}")


if __name__ == "__main__":
    app()
