"""한 번의 실행(run)에 필요한 공용 객체 묶음: 설정, DB 세션, 비용 추적, LLM."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from functools import cached_property
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import select

from .config import Settings, get_settings
from .costs import CostTracker
from .logging_setup import attach_run_log
from .models import Run, session_scope


def today(settings: Settings) -> str:
    return datetime.now(ZoneInfo(settings.schedule.timezone)).strftime("%Y-%m-%d")


class RunContext:
    def __init__(self, run_date: str | None = None, settings: Settings | None = None, llm: Any | None = None):
        self.settings = settings or get_settings()
        self.run_date = run_date or today(self.settings)
        self.session = session_scope(self.settings.db_url)
        self.run = self.session.scalar(select(Run).where(Run.date == self.run_date))
        if self.run is None:
            self.run = Run(date=self.run_date, status="started", usage={})
            self.session.add(self.run)
            self.session.commit()
        self.run_dir: Path = self.settings.run_dir(self.run_date)
        attach_run_log(self.run_dir)
        # 같은 날 재실행 시 앞선 비용을 이어서 집계 → 일일 상한이 실제로 "하루" 기준이 됨
        self.tracker = CostTracker(self.settings.budget.max_daily_cost_usd, self.run_date,
                                   initial_cost=self.run.cost_usd or 0.0, initial_usage=self.run.usage or {})
        self._llm = llm

    @cached_property
    def llm(self):
        if self._llm is not None:
            return self._llm
        from .llm import make_llm
        return make_llm(self.settings, self.tracker)

    # ---- 산출물 파일 ----
    def write_json(self, name: str, data: Any) -> Path:
        p = self.run_dir / name
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(data, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
        return p

    def read_json(self, name: str) -> Any:
        return json.loads((self.run_dir / name).read_text(encoding="utf-8"))

    # ---- 상태 ----
    def step_done(self, step: str) -> bool:
        from .models import RUN_STEPS
        if self.run.status not in RUN_STEPS:
            return False
        return RUN_STEPS.index(self.run.status) >= RUN_STEPS.index(step)

    def set_status(self, status: str) -> None:
        self.run.status = status
        self.save()

    def save(self) -> None:
        snap = self.tracker.snapshot()
        self.run.cost_usd = snap["cost_usd"]
        self.run.usage = snap["usage"]
        self.session.commit()

    def finish(self, error: str | None = None) -> None:
        self.run.finished_at = datetime.now(timezone.utc)
        self.run.error = error
        self.save()

    def close(self) -> None:
        self.save()
        self.session.close()

    def __enter__(self) -> "RunContext":
        return self

    def __exit__(self, *exc) -> None:
        self.close()
