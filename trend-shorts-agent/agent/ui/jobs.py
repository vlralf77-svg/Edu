"""제어판에서 누른 작업(분석·제작 등)을 별도 프로세스로 실행하고 로그를 보여준다.

화면이 새로고침돼도 작업은 계속 돌아가며, 한 번에 하나만 실행한다.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path

from ..config import PROJECT_ROOT

JOB_LABELS = {
    "run-daily": "오늘 트렌드 분석 (수집→주제→조사→대본)",
    "produce": "승인된 영상 제작",
    "sample": "샘플 영상 만들기",
    "collect": "YouTube 수집 테스트",
}


@dataclass
class Job:
    name: str
    args: list[str]
    log: Path
    pid: int
    started: float
    returncode: int | None = None

    @property
    def label(self) -> str:
        return JOB_LABELS.get(self.name, self.name)


_current: dict[str, tuple[Job, subprocess.Popen]] = {}


def _state_file(data_dir: Path) -> Path:
    return data_dir / "jobs" / "last.json"


def start(name: str, args: list[str], data_dir: Path) -> Job:
    if (cur := current()) and cur.returncode is None:
        raise RuntimeError(f"이미 실행 중인 작업이 있습니다: {cur.label}")
    log_dir = data_dir / "jobs"
    log_dir.mkdir(parents=True, exist_ok=True)
    log = log_dir / f"{time.strftime('%Y%m%d-%H%M%S')}-{name}.log"
    flags = subprocess.CREATE_NO_WINDOW if sys.platform.startswith("win") else 0
    fh = open(log, "w", encoding="utf-8")
    env = {**os.environ, "PYTHONIOENCODING": "utf-8", "PYTHONUTF8": "1"}
    proc = subprocess.Popen([sys.executable, "-m", "agent", *args], cwd=PROJECT_ROOT, stdout=fh,
                            stderr=subprocess.STDOUT, env=env, creationflags=flags)
    job = Job(name, args, log, proc.pid, time.time())
    _current["job"] = (job, proc)
    _state_file(data_dir).write_text(json.dumps({"name": name, "log": str(log), "started": job.started}),
                                     encoding="utf-8")
    return job


def current() -> Job | None:
    if "job" not in _current:
        return None
    job, proc = _current["job"]
    job.returncode = proc.poll()
    return job


def last(data_dir: Path) -> Job | None:
    """제어판을 다시 켰을 때 지난 작업 로그라도 보여주기."""
    if (j := current()) is not None:
        return j
    f = _state_file(data_dir)
    if not f.exists():
        return None
    d = json.loads(f.read_text(encoding="utf-8"))
    return Job(d["name"], [], Path(d["log"]), 0, d["started"], returncode=-999)


def stop() -> None:
    if "job" in _current:
        _current["job"][1].terminate()


def tail(path: Path, n: int = 40) -> str:
    if not path.exists():
        return ""
    lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    return "\n".join(lines[-n:])
