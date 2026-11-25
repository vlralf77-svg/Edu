"""스케줄링: APScheduler 로 매일 run_at 에 실행. 락 파일로 하루 1회·중복 실행 방지, 실패 시 알림."""
from __future__ import annotations

import fcntl
import logging
import os
from contextlib import contextmanager
from pathlib import Path

from .config import Settings, get_settings
from .context import today
from .notify import notify

log = logging.getLogger(__name__)


class AlreadyRunning(RuntimeError):
    pass


@contextmanager
def file_lock(path: Path):
    """프로세스 간 배타 락 (실행 중 중복 방지). 비정상 종료 시 OS 가 자동 해제."""
    path.parent.mkdir(parents=True, exist_ok=True)
    fd = os.open(path, os.O_CREAT | os.O_RDWR)
    try:
        try:
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as e:
            raise AlreadyRunning(f"이미 실행 중: {path}") from e
        os.ftruncate(fd, 0)
        os.write(fd, str(os.getpid()).encode())
        yield
    finally:
        fcntl.flock(fd, fcntl.LOCK_UN)
        os.close(fd)


def done_marker(settings: Settings, run_date: str) -> Path:
    return settings.data_dir / "runs" / run_date / ".daily_done"


def daily_job(settings: Settings | None = None, run_fn=None) -> str | None:
    """하루 1회 보장: 완료 마커가 있으면 건너뜀. 동시에 두 번 뜨면 락으로 막음."""
    settings = settings or get_settings()
    run_date = today(settings)
    marker = done_marker(settings, run_date)
    if marker.exists():
        log.info("%s 은 이미 실행 완료 → 건너뜀", run_date)
        return None
    if run_fn is None:
        from .pipeline import run_daily as run_fn  # noqa: N813
    try:
        with file_lock(settings.data_dir / "daily.lock"):
            if marker.exists():
                return None
            run_fn(run_date, settings=settings)
            marker.parent.mkdir(parents=True, exist_ok=True)
            marker.write_text("ok", encoding="utf-8")
            return run_date
    except AlreadyRunning as e:
        log.warning("%s", e)
        return None
    except Exception as e:
        log.exception("일일 실행 실패")
        notify(f"⚠️ 일일 실행 실패 ({run_date}): {type(e).__name__}: {e}", True)
        return None


def start_scheduler(settings: Settings | None = None, run_now_if_missed: bool = True) -> None:
    from apscheduler.schedulers.blocking import BlockingScheduler
    from apscheduler.triggers.cron import CronTrigger

    settings = settings or get_settings()
    hh, mm = (int(x) for x in settings.schedule.run_at.split(":"))
    sched = BlockingScheduler(timezone=settings.schedule.timezone)
    sched.add_job(daily_job, CronTrigger(hour=hh, minute=mm, timezone=settings.schedule.timezone),
                  kwargs={"settings": settings}, id="daily", max_instances=1, coalesce=True,
                  misfire_grace_time=3 * 3600)
    if run_now_if_missed:
        from datetime import datetime
        from zoneinfo import ZoneInfo
        now = datetime.now(ZoneInfo(settings.schedule.timezone))
        if (now.hour, now.minute) >= (hh, mm):  # 오늘 예정 시각이 지났는데 아직 안 돌았으면 바로 1회
            sched.add_job(daily_job, kwargs={"settings": settings}, id="catchup")
    log.info("스케줄러 시작: 매일 %s (%s)", settings.schedule.run_at, settings.schedule.timezone)
    sched.start()


def crontab_line(settings: Settings, project_dir: Path, python: str = ".venv/bin/python") -> str:
    hh, mm = settings.schedule.run_at.split(":")
    return (f"CRON_TZ={settings.schedule.timezone}\n"
            f"{int(mm)} {int(hh)} * * * cd {project_dir} && {python} -m agent daily-job >> data/cron.log 2>&1")
