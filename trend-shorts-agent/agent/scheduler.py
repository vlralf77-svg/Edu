"""스케줄링 (서버 없이 내 PC 에서).

- 실행 보장: 락 파일로 중복 실행 방지 + 날짜별 완료 마커로 하루 1회, 실패 시 알림
- 방법 A: OS 예약 작업 등록 (권장) — Windows 작업 스케줄러 / Mac·Linux crontab.
          PC 가 꺼져 있어서 놓친 날은 다음 로그인(부팅) 때 `daily-job --if-due` 로 보충 실행
- 방법 B: `python -m agent schedule` — APScheduler 로 창을 띄워 둔 동안 실행
"""
from __future__ import annotations

import logging
import os
import subprocess
import sys
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from .config import PROJECT_ROOT, Settings, get_settings
from .context import today
from .notify import notify

log = logging.getLogger(__name__)
TASK_NAME = "TrendShortsAgent"
CRON_BEGIN, CRON_END = "# >>> trend-shorts-agent >>>", "# <<< trend-shorts-agent <<<"
IS_WINDOWS = sys.platform.startswith("win")


class AlreadyRunning(RuntimeError):
    pass


# ---------------------------------------------------------------- 락 (Windows/Mac/Linux)
@contextmanager
def file_lock(path: Path):
    """프로세스 간 배타 락. 비정상 종료 시 OS 가 자동 해제."""
    path.parent.mkdir(parents=True, exist_ok=True)
    fd = os.open(path, os.O_CREAT | os.O_RDWR)
    locked = False
    try:
        try:
            if IS_WINDOWS:
                import msvcrt
                msvcrt.locking(fd, msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            locked = True
        except OSError as e:  # BlockingIOError 포함
            raise AlreadyRunning(f"이미 실행 중: {path}") from e
        yield
    finally:
        if locked:
            if IS_WINDOWS:
                import msvcrt
                os.lseek(fd, 0, 0)
                msvcrt.locking(fd, msvcrt.LK_UNLCK, 1)
            else:
                import fcntl
                fcntl.flock(fd, fcntl.LOCK_UN)
        os.close(fd)


def done_marker(settings: Settings, run_date: str) -> Path:
    return settings.data_dir / "runs" / run_date / ".daily_done"


def is_due(settings: Settings, now: datetime | None = None) -> bool:
    """오늘 예정 시각이 지났고 아직 실행 완료가 안 됐으면 True."""
    tz = ZoneInfo(settings.schedule.timezone)
    now = (now or datetime.now(tz)).astimezone(tz)
    hh, mm = (int(x) for x in settings.schedule.run_at.split(":"))
    return (now.hour, now.minute) >= (hh, mm) and not done_marker(settings, now.strftime("%Y-%m-%d")).exists()


def daily_job(settings: Settings | None = None, run_fn=None, if_due: bool = False) -> str | None:
    """하루 1회 보장: 완료 마커가 있으면 건너뜀. 동시에 두 번 뜨면 락으로 막음."""
    settings = settings or get_settings()
    run_date = today(settings)
    marker = done_marker(settings, run_date)
    if marker.exists():
        log.info("%s 은 이미 실행 완료 → 건너뜀", run_date)
        return None
    if if_due and not is_due(settings):
        log.info("아직 예정 시각(%s) 전 → 건너뜀", settings.schedule.run_at)
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


# ---------------------------------------------------------------- 방법 B: APScheduler
def start_scheduler(settings: Settings | None = None, run_now_if_missed: bool = True) -> None:
    from apscheduler.schedulers.blocking import BlockingScheduler
    from apscheduler.triggers.cron import CronTrigger

    settings = settings or get_settings()
    hh, mm = (int(x) for x in settings.schedule.run_at.split(":"))
    sched = BlockingScheduler(timezone=settings.schedule.timezone)
    sched.add_job(daily_job, CronTrigger(hour=hh, minute=mm, timezone=settings.schedule.timezone),
                  kwargs={"settings": settings}, id="daily", max_instances=1, coalesce=True,
                  misfire_grace_time=3 * 3600)
    if run_now_if_missed and is_due(settings):
        sched.add_job(daily_job, kwargs={"settings": settings}, id="catchup")
    log.info("스케줄러 시작: 매일 %s (%s)", settings.schedule.run_at, settings.schedule.timezone)
    sched.start()


# ---------------------------------------------------------------- 방법 A: OS 예약 작업
def venv_python(project: Path = PROJECT_ROOT) -> Path:
    win = project / ".venv" / "Scripts" / "python.exe"
    nix = project / ".venv" / "bin" / "python"
    return win if IS_WINDOWS or (win.exists() and not nix.exists()) else nix


def local_hhmm(settings: Settings) -> str:
    """설정 시각(설정 시간대)을 이 PC 의 현지 시각으로 변환 (작업 스케줄러·cron 은 PC 시간 기준)."""
    tz = ZoneInfo(settings.schedule.timezone)
    hh, mm = (int(x) for x in settings.schedule.run_at.split(":"))
    target = datetime.now(tz).replace(hour=hh, minute=mm, second=0, microsecond=0)
    return target.astimezone().strftime("%H:%M")


def windows_job_bat(project: Path, if_due: bool) -> str:
    py = venv_python(project)
    flag = " --if-due" if if_due else ""
    return (f'@echo off\r\nchcp 65001 >nul\r\ncd /d "{project}"\r\n'
            f'"{py}" -m agent daily-job{flag} >> "{project / "data" / "schedule.log"}" 2>&1\r\n')


def windows_startup_dir() -> Path:
    return Path(os.environ.get("APPDATA", "")) / "Microsoft" / "Windows" / "Start Menu" / "Programs" / "Startup"


def windows_commands(settings: Settings, daily_bat: Path) -> list[list[str]]:
    return [["schtasks", "/Create", "/F", "/SC", "DAILY", "/TN", TASK_NAME, "/ST", local_hhmm(settings),
             "/TR", f'"{daily_bat}"']]


def crontab_block(settings: Settings, project: Path, python: Path | str | None = None) -> str:
    py = python or venv_python(project)
    hh, mm = local_hhmm(settings).split(":")
    log_path = project / "data" / "schedule.log"
    return "\n".join([
        CRON_BEGIN,
        f'{int(mm)} {int(hh)} * * * cd "{project}" && "{py}" -m agent daily-job >> "{log_path}" 2>&1',
        f'@reboot sleep 120 && cd "{project}" && "{py}" -m agent daily-job --if-due >> "{log_path}" 2>&1',
        CRON_END,
    ])


def merge_crontab(existing: str, block: str | None) -> str:
    """기존 crontab 에서 우리 블록만 교체/삭제 (다른 사용자 작업은 유지)."""
    lines, skip, out = existing.splitlines(), False, []
    for line in lines:
        if line.strip() == CRON_BEGIN:
            skip = True
            continue
        if line.strip() == CRON_END:
            skip = False
            continue
        if not skip:
            out.append(line)
    while out and not out[-1].strip():
        out.pop()
    if block:
        out += ([""] if out else []) + block.splitlines()
    return "\n".join(out) + "\n" if out else ""


def crontab_line(settings: Settings, project_dir: Path, python: str = ".venv/bin/python") -> str:
    """(하위 호환) cron 한 줄."""
    hh, mm = settings.schedule.run_at.split(":")
    return (f"CRON_TZ={settings.schedule.timezone}\n"
            f"{int(mm)} {int(hh)} * * * cd {project_dir} && {python} -m agent daily-job >> data/cron.log 2>&1")


def _read_crontab() -> str:
    r = subprocess.run(["crontab", "-l"], capture_output=True, text=True)
    return r.stdout if r.returncode == 0 else ""


def install_schedule(settings: Settings | None = None, project: Path = PROJECT_ROOT) -> str:
    settings = settings or get_settings()
    (project / "data").mkdir(parents=True, exist_ok=True)
    if IS_WINDOWS:
        daily_bat = project / "data" / "run_daily_job.bat"
        daily_bat.write_text(windows_job_bat(project, False), encoding="utf-8")
        for cmd in windows_commands(settings, daily_bat):
            subprocess.run(cmd, check=True, capture_output=True)
        # 놓친 날 보충: 로그인할 때 '예정 시각이 지났고 아직 안 돌았으면' 실행 (관리자 권한 불필요)
        startup = windows_startup_dir()
        startup.mkdir(parents=True, exist_ok=True)
        (startup / f"{TASK_NAME}-catchup.bat").write_text(windows_job_bat(project, True), encoding="utf-8")
        return f"Windows 작업 스케줄러에 등록: 매일 {local_hhmm(settings)} + 로그인 시 보충 실행"
    block = crontab_block(settings, project)
    new = merge_crontab(_read_crontab(), block)
    subprocess.run(["crontab", "-"], input=new, text=True, check=True)
    return f"crontab 에 등록: 매일 {local_hhmm(settings)} + 부팅 시 보충 실행"


def uninstall_schedule() -> str:
    if IS_WINDOWS:
        subprocess.run(["schtasks", "/Delete", "/F", "/TN", TASK_NAME], capture_output=True)
        (windows_startup_dir() / f"{TASK_NAME}-catchup.bat").unlink(missing_ok=True)
        return "자동 실행 해제 완료"
    subprocess.run(["crontab", "-"], input=merge_crontab(_read_crontab(), None), text=True, check=True)
    return "자동 실행 해제 완료"


def schedule_status() -> str | None:
    """등록돼 있으면 설명 문자열, 아니면 None."""
    try:
        if IS_WINDOWS:
            r = subprocess.run(["schtasks", "/Query", "/TN", TASK_NAME, "/FO", "LIST"], capture_output=True,
                               text=True)
            return r.stdout.strip() if r.returncode == 0 else None
        cur = _read_crontab()
        if CRON_BEGIN in cur:
            return cur[cur.index(CRON_BEGIN): cur.index(CRON_END) + len(CRON_END)]
    except OSError:
        return None
    return None
