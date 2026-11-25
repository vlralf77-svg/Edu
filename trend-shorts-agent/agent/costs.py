"""run 단위 비용·사용량 집계 + 일일 상한 체크."""
from __future__ import annotations

import logging
import threading
from collections import defaultdict
from datetime import datetime, timezone

log = logging.getLogger(__name__)

# 외부 서비스 대략 단가 (USD). 실제 요금제에 맞게 settings 로 옮겨도 됨.
UNIT_PRICES = {
    "tts_chars:elevenlabs": 0.30 / 1000,
    "tts_chars:google": 16.0 / 1_000_000,
    "tts_chars:dummy": 0.0,
}


class BudgetExceeded(RuntimeError):
    pass


class CostTracker:
    def __init__(self, max_cost_usd: float, run_date: str | None = None, initial_cost: float = 0.0,
                 initial_usage: dict | None = None):
        self.max_cost_usd = max_cost_usd
        self.run_date = run_date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
        self.cost_usd = initial_cost
        self.usage: dict[str, float] = defaultdict(float, initial_usage or {})
        self._lock = threading.Lock()

    def add(self, counter: str, amount: float = 1, cost_usd: float | None = None) -> None:
        with self._lock:
            self.usage[counter] += amount
            if cost_usd is None:
                cost_usd = UNIT_PRICES.get(counter, 0.0) * amount
            self.cost_usd += cost_usd
        if cost_usd:
            log.debug("cost +$%.4f (%s=%s) → $%.4f", cost_usd, counter, amount, self.cost_usd)

    def check(self) -> None:
        if self.cost_usd > self.max_cost_usd:
            raise BudgetExceeded(f"일일 비용 상한 초과: ${self.cost_usd:.2f} > ${self.max_cost_usd:.2f}")

    def snapshot(self) -> dict:
        return {"cost_usd": round(self.cost_usd, 4), "usage": dict(self.usage)}
