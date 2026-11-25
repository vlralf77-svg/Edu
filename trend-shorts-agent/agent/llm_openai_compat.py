"""무료로 쓸 수 있는 OpenAI 호환 API 래퍼 (Groq / OpenRouter). Claude·Gemini 래퍼와 같은 인터페이스.

- Groq: https://console.groq.com/keys (무료 등급, 카드 불필요) — GROQ_API_KEY
- OpenRouter: https://openrouter.ai/keys (':free' 모델은 무료, 하루 호출 수 제한) — OPENROUTER_API_KEY
- 웹 검색 기능은 없음 → 조사는 구글 뉴스 RSS 사용 (research.provider: auto)
"""
from __future__ import annotations

import json
import logging
import time
from typing import Any

import httpx

from .config import Settings, env
from .costs import CostTracker
from .llm import LLMError, LLMRefusal, LLMResult, extract_json

log = logging.getLogger(__name__)

PROVIDERS = {
    "groq": {"base": "https://api.groq.com/openai/v1", "key": "GROQ_API_KEY",
             "signup": "https://console.groq.com/keys"},
    "openrouter": {"base": "https://openrouter.ai/api/v1", "key": "OPENROUTER_API_KEY",
                   "signup": "https://openrouter.ai/keys"},
}


class OpenAICompatLLM:
    def __init__(self, settings: Settings, tracker: CostTracker | None = None, http: httpx.Client | None = None,
                 sleep=time.sleep):
        self.cfg = settings.llm
        self.provider = self.cfg.provider
        p = PROVIDERS[self.provider]
        self.base = p["base"]
        self.key = env(p["key"])
        if not self.key:
            raise LLMError(f"{p['key']} 가 없습니다. {p['signup']} 에서 무료로 발급해 설정에 입력하세요.")
        self.model = self.cfg.groq_model if self.provider == "groq" else self.cfg.openrouter_model
        self.tracker = tracker
        self.http = http or httpx.Client(timeout=180)
        self.sleep = sleep

    @staticmethod
    def web_search_tool(max_uses: int = 5) -> dict:
        return {"type": "unsupported_web_search"}

    def _post(self, body: dict) -> dict:
        delay = 5.0
        for attempt in range(self.cfg.max_retries + 2):
            try:
                r = self.http.post(f"{self.base}/chat/completions", json=body,
                                   headers={"Authorization": f"Bearer {self.key}"})
            except httpx.TransportError as e:
                if attempt > self.cfg.max_retries:
                    raise LLMError(f"{self.provider} 연결 실패 (인터넷 확인): {e}") from e
                self.sleep(delay)
                delay = min(delay * 2, 60)
                continue
            if r.status_code in (429, 500, 502, 503) and attempt <= self.cfg.max_retries:
                wait = float(r.headers.get("retry-after", 0) or 0) or delay
                log.warning("%s %d → %.0f초 후 재시도 (%s)", self.provider, r.status_code, wait, self._msg(r)[:120])
                self.sleep(min(wait, 120))
                delay = min(delay * 2, 60)
                continue
            if r.status_code >= 400:
                raise LLMError(f"{self.provider} API 오류 {r.status_code}: {self._msg(r)}")
            return r.json()
        raise LLMError(f"{self.provider} 재시도 횟수 초과 — 잠시 뒤 다시 실행하세요")

    @staticmethod
    def _msg(r: httpx.Response) -> str:
        try:
            e = r.json().get("error", {})
            return (e.get("message") if isinstance(e, dict) else str(e)) or r.reason_phrase
        except ValueError:
            return r.text[:300]

    def complete(self, prompt: str, *, system: str | None = None, tools: list[dict] | None = None,
                 json_schema: dict | None = None, max_tokens: int | None = None) -> LLMResult:
        if tools:
            raise LLMError(f"{self.provider} 는 웹 검색을 지원하지 않습니다 (조사는 구글 뉴스 RSS 사용)")
        if self.tracker:
            self.tracker.check()
        sys_parts = [system] if system else []
        body: dict[str, Any] = {"model": self.model, "max_tokens": min(max_tokens or self.cfg.max_tokens, 8000)}
        if json_schema:
            sys_parts.append("반드시 아래 JSON 스키마를 따르는 JSON 객체 하나만 출력하라. 다른 말은 쓰지 마라.\n"
                             + json.dumps(json_schema, ensure_ascii=False))
            body["response_format"] = {"type": "json_object"}
        msgs = ([{"role": "system", "content": "\n\n".join(sys_parts)}] if sys_parts else [])
        body["messages"] = msgs + [{"role": "user", "content": prompt}]
        try:
            data = self._post(body)
        except LLMError as e:
            if json_schema and "response_format" in str(e).lower():  # JSON 모드 미지원 모델
                body.pop("response_format")
                data = self._post(body)
            else:
                raise
        choice = (data.get("choices") or [{}])[0]
        if choice.get("finish_reason") == "content_filter":
            raise LLMRefusal(f"{self.provider} 안전 필터로 응답 중단")
        text = (choice.get("message") or {}).get("content") or ""
        u = data.get("usage") or {}
        res = LLMResult(text=text, input_tokens=u.get("prompt_tokens", 0), output_tokens=u.get("completion_tokens", 0),
                        stop_reason=choice.get("finish_reason"))
        if self.tracker:
            self.tracker.add("llm_input_tokens", res.input_tokens, cost_usd=0)
            self.tracker.add("llm_output_tokens", res.output_tokens, cost_usd=0)
            self.tracker.add("llm_calls", 1, cost_usd=0)
        log.info("%s(%s) 호출: in=%d out=%d", self.provider, self.model, res.input_tokens, res.output_tokens)
        return res

    def complete_json(self, prompt: str, *, schema: dict | None = None, tools: list[dict] | None = None,
                      system: str | None = None, max_tokens: int | None = None) -> tuple[Any, LLMResult]:
        res = self.complete(prompt, system=system, tools=tools, json_schema=schema, max_tokens=max_tokens)
        return extract_json(res.text), res
