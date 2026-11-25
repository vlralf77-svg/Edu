"""Claude API 래퍼: 재시도(지수 백오프), 토큰·비용 로깅, JSON 출력, web search 툴."""
from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field
from typing import Any

import anthropic

from .config import Settings
from .costs import CostTracker

log = logging.getLogger(__name__)

FALLBACK_BETA = "server-side-fallback-2026-07-01"
WEB_SEARCH_TOOL = "web_search_20260209"


class LLMError(RuntimeError):
    pass


class LLMRefusal(LLMError):
    pass


@dataclass
class LLMResult:
    text: str
    content: list[Any] = field(default_factory=list)
    input_tokens: int = 0
    output_tokens: int = 0
    web_searches: int = 0
    cost_usd: float = 0.0
    stop_reason: str | None = None


def extract_json(text: str) -> Any:
    """응답 텍스트에서 JSON(객체/배열)을 뽑아 파싱한다. ```json 펜스 우선, 없으면 첫 번째 균형 잡힌 괄호."""
    m = re.search(r"```(?:json)?\s*(.+?)```", text, re.S)
    candidates = [m.group(1)] if m else []
    candidates.append(text)
    for cand in candidates:
        cand = cand.strip()
        try:
            return json.loads(cand)
        except json.JSONDecodeError:
            pass
        for opener, closer in (("{", "}"), ("[", "]")):
            start = cand.find(opener)
            while start != -1:
                depth, in_str, esc = 0, False, False
                for i in range(start, len(cand)):
                    ch = cand[i]
                    if in_str:
                        if esc:
                            esc = False
                        elif ch == "\\":
                            esc = True
                        elif ch == '"':
                            in_str = False
                    elif ch == '"':
                        in_str = True
                    elif ch == opener:
                        depth += 1
                    elif ch == closer:
                        depth -= 1
                        if depth == 0:
                            try:
                                return json.loads(cand[start : i + 1])
                            except json.JSONDecodeError:
                                break
                start = cand.find(opener, start + 1)
    raise LLMError(f"JSON 파싱 실패: {text[:300]}")


class LLM:
    def __init__(self, settings: Settings, tracker: CostTracker | None = None, client: Any | None = None):
        self.cfg = settings.llm
        self.tracker = tracker
        # SDK 자체 재시도: 408/409/429/5xx/연결오류에 지수 백오프
        self.client = client or anthropic.Anthropic(max_retries=self.cfg.max_retries)

    # ------------------------------------------------------------------ core
    def _create(self, **kwargs: Any) -> Any:
        params = dict(
            model=self.cfg.model,
            max_tokens=kwargs.pop("max_tokens", None) or self.cfg.max_tokens,
            output_config={"effort": self.cfg.effort, **kwargs.pop("output_config", {})},
            **kwargs,
        )
        if self.cfg.fallbacks:
            return self.client.beta.messages.create(betas=[FALLBACK_BETA], fallbacks=self.cfg.fallbacks, **params)
        return self.client.messages.create(**params)

    def _account(self, resp: Any, result: LLMResult) -> None:
        u = getattr(resp, "usage", None)
        if u is None:
            return
        itok = (getattr(u, "input_tokens", 0) or 0) + (getattr(u, "cache_creation_input_tokens", 0) or 0) \
            + (getattr(u, "cache_read_input_tokens", 0) or 0)
        otok = getattr(u, "output_tokens", 0) or 0
        stu = getattr(u, "server_tool_use", None)
        searches = (getattr(stu, "web_search_requests", 0) or 0) if stu else 0
        price = self.cfg.price_per_mtok
        cost = itok / 1e6 * price.get("input", 0) + otok / 1e6 * price.get("output", 0) \
            + searches / 1000 * self.cfg.web_search_price_per_1k
        result.input_tokens += itok
        result.output_tokens += otok
        result.web_searches += searches
        result.cost_usd += cost
        if self.tracker:
            self.tracker.add("llm_input_tokens", itok, cost_usd=0)
            self.tracker.add("llm_output_tokens", otok, cost_usd=0)
            self.tracker.add("llm_calls", 1, cost_usd=cost)
            if searches:
                self.tracker.add("web_searches", searches, cost_usd=0)

    def complete(
        self,
        prompt: str,
        *,
        system: str | None = None,
        tools: list[dict] | None = None,
        json_schema: dict | None = None,
        max_tokens: int | None = None,
        max_continuations: int = 4,
    ) -> LLMResult:
        if self.tracker:
            self.tracker.check()
        messages: list[dict] = [{"role": "user", "content": prompt}]
        kwargs: dict[str, Any] = {}
        if system:
            kwargs["system"] = system
        if tools:
            kwargs["tools"] = tools
        if json_schema:
            kwargs["output_config"] = {"format": {"type": "json_schema", "schema": json_schema}}
        result = LLMResult(text="")
        for _ in range(max_continuations + 1):
            try:
                resp = self._create(messages=messages, max_tokens=max_tokens, **kwargs)
            except anthropic.APIStatusError as e:  # 재시도 후에도 실패
                raise LLMError(f"Claude API 오류 {e.status_code}: {e.message}") from e
            except anthropic.APIConnectionError as e:
                raise LLMError(f"Claude API 연결 실패: {e}") from e
            self._account(resp, result)
            result.stop_reason = resp.stop_reason
            result.content.extend(resp.content)
            if resp.stop_reason == "refusal":
                raise LLMRefusal("모델이 요청을 거절했습니다")
            if resp.stop_reason == "pause_turn":  # 서버 툴(web search) 장기 실행 → 이어서 요청
                messages = messages + [{"role": "assistant", "content": resp.content}]
                continue
            break
        result.text = "".join(getattr(b, "text", "") for b in result.content if getattr(b, "type", "") == "text")
        log.info("LLM 호출: in=%d out=%d search=%d $%.4f", result.input_tokens, result.output_tokens,
                 result.web_searches, result.cost_usd)
        return result

    def complete_json(self, prompt: str, *, schema: dict | None = None, tools: list[dict] | None = None,
                      system: str | None = None, max_tokens: int | None = None) -> tuple[Any, LLMResult]:
        """JSON 응답. 툴이 없고 스키마가 있으면 structured output 으로 강제, 아니면 텍스트에서 추출."""
        use_schema = schema if (schema and not tools) else None
        res = self.complete(prompt, system=system, tools=tools, json_schema=use_schema, max_tokens=max_tokens)
        return extract_json(res.text), res

    @staticmethod
    def web_search_tool(max_uses: int = 5) -> dict:
        return {"type": WEB_SEARCH_TOOL, "name": "web_search", "max_uses": max_uses}
