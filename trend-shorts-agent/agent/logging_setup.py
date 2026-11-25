"""로깅: 콘솔 + data/runs/DATE/run.log, 단계별 소요시간."""
from __future__ import annotations

import logging
import time
from contextlib import contextmanager
from pathlib import Path

FMT = "%(asctime)s %(levelname)-7s %(name)s | %(message)s"
_file_handlers: dict[str, logging.Handler] = {}


def setup_logging(level: str = "INFO") -> None:
    root = logging.getLogger()
    if not any(isinstance(h, logging.StreamHandler) and not isinstance(h, logging.FileHandler) for h in root.handlers):
        h = logging.StreamHandler()
        h.setFormatter(logging.Formatter(FMT))
        root.addHandler(h)
    root.setLevel(level)
    for noisy in ("httpx", "httpcore", "anthropic", "urllib3"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


def attach_run_log(run_dir: Path) -> None:
    key = str(run_dir)
    if key in _file_handlers:
        return
    run_dir.mkdir(parents=True, exist_ok=True)
    fh = logging.FileHandler(run_dir / "run.log", encoding="utf-8")
    fh.setFormatter(logging.Formatter(FMT))
    logging.getLogger().addHandler(fh)
    _file_handlers[key] = fh


@contextmanager
def timed(step: str, logger: logging.Logger | None = None):
    log = logger or logging.getLogger("agent.timing")
    t0 = time.perf_counter()
    log.info("▶ %s 시작", step)
    try:
        yield
    finally:
        log.info("■ %s 종료 (%.1fs)", step, time.perf_counter() - t0)
