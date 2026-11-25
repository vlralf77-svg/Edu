"""Google Gemini API 래퍼 (무료 등급 사용 가능). Claude 래퍼(agent/llm.py)와 같은 인터페이스.

- REST v1beta generateContent, 인증 헤더 x-goog-api-key (키 발급: https://aistudio.google.com/apikey)
- JSON 출력: responseMimeType=application/json + responseSchema (스키마 거부 시 스키마 없이 재시도)
- 웹 검색: tools=[{"google_search": {}}] (Grounding with Google Search). 출처 URL 은 리다이렉트 주소라 실제 주소로 풀어서 검증
- 무료 등급 분당 호출 제한 대비: 호출 간 최소 간격 + 429/5xx 지수 백오프
- 설정한 모델이 없으면(404) 사용 가능한 flash 모델로 자동 전환
"""
from __future__ import annotations

import logging
import re
import threading
import time
from dataclasses import dataclass
from typing import Any

import httpx

from .config import Settings, env
from .costs import CostTracker
from .llm import LLMError, LLMRefusal, LLMResult, extract_json

log = logging.getLogger(__name__)
API = "https://generativelanguage.googleapis.com/v1beta"
GOOGLE_SEARCH_TOOL = {"type": "gemini_google_search"}


@dataclass
class _SearchResult:  # research.py 의 _searched_urls 가 읽는 형태 (Claude web_search 결과와 동일한 모양)
    url: str
    title: str = ""


@dataclass
class _SearchBlock:
    content: list
    type: str = "web_search_tool_result"


def to_gemini_schema(schema: Any) -> Any:
    """JSON Schema → Gemini responseSchema (OpenAPI 부분집합): additionalProperties 제거, type 대문자."""
    if isinstance(schema, list):
        return [to_gemini_schema(s) for s in schema]
    if not isinstance(schema, dict):
        return schema
    out = {}
    for k, v in schema.items():
        if k == "additionalProperties":
            continue
        if k == "type" and isinstance(v, str):
            out[k] = v.upper()
        elif k in ("properties",):
            out[k] = {pk: to_gemini_schema(pv) for pk, pv in v.items()}
        else:
            out[k] = to_gemini_schema(v)
    if out.get("type") == "OBJECT" and "properties" in out:
        out["propertyOrdering"] = list(out["properties"])
    return out


def pick_flash_model(names: list[str]) -> str | None:
    """사용 가능한 모델 목록에서 안정판 flash 모델(가장 높은 버전) 선택."""
    cands = []
    for n in names:
        n = n.removeprefix("models/")
        if "flash" not in n or re.search(r"(lite|image|tts|live|audio|embed|thinking|exp|preview)", n):
            continue
        ver = tuple(int(x) for x in re.findall(r"(\d+)", n.split("flash")[0])) or (0,)
        cands.append((ver, n))
    return max(cands)[1] if cands else None


class _Busy(LLMError):
    """혼잡(5xx)·한도(429)·모델 없음 — 다른 모델로 넘어갈 수 있는 실패."""

    def __init__(self, status: int, msg: str):
        super().__init__(msg)
        self.status = status


class GeminiLLM:
    def __init__(self, settings: Settings, tracker: CostTracker | None = None, http: httpx.Client | None = None,
                 sleep=time.sleep):
        self.cfg = settings.llm
        self.tracker = tracker
        self.model = self.cfg.gemini_model
        self.key = env("GEMINI_API_KEY")
        if not self.key:
            raise LLMError("GEMINI_API_KEY 가 없습니다. https://aistudio.google.com/apikey 에서 무료로 발급해 설정에 입력하세요.")
        self.http = http or httpx.Client(timeout=180)
        self.sleep = sleep
        self._last_call = 0.0
        self._lock = threading.Lock()
        self._model_checked = False

    # ------------------------------------------------------------------ HTTP
    def _throttle(self) -> None:
        with self._lock:
            wait = self.cfg.gemini_min_interval_sec - (time.monotonic() - self._last_call)
            if wait > 0:
                self.sleep(wait)
            self._last_call = time.monotonic()

    def _post(self, body: dict) -> dict:
        """현재 모델로 시도 → 혼잡(503)·한도(429)가 계속되면 다른 무료 모델로 자동 전환."""
        tried: set[str] = set()
        last: Exception | None = None
        while True:
            try:
                return self._post_model(body)
            except _Busy as e:
                last = e
                tried.add(self.model)
                nxt = self._next_fallback(tried)
                if not nxt:
                    break
                log.warning("Gemini '%s' 사용 불가(%s) → 무료 모델 '%s' 로 전환", self.model, e.status, nxt)
                self.model = nxt
        hint = (" — 무료 등급 하루 사용량을 다 썼을 수 있습니다. 내일 다시 실행하거나 하루 주제 수를 줄이세요."
                if getattr(last, "status", 0) == 429 else
                " — 구글 무료 서버가 혼잡합니다. 10~30분 뒤 다시 실행하면 완료된 단계는 건너뛰고 이어서 진행합니다.")
        raise LLMError(f"Gemini API 오류 {getattr(last, 'status', '')}: {last}{hint} (시도한 모델: {', '.join(sorted(tried))})")

    def _post_model(self, body: dict) -> dict:
        delay = 5.0
        retries = self.cfg.gemini_retries
        for attempt in range(retries + 1):
            self._throttle()
            try:
                r = self.http.post(f"{API}/models/{self.model}:generateContent", json=body,
                                   headers={"x-goog-api-key": self.key})
            except httpx.TransportError as e:
                if attempt >= retries:
                    raise LLMError(f"Gemini 연결 실패 (인터넷 연결 확인): {e}") from e
                self.sleep(delay)
                delay = min(delay * 2, 60)
                continue
            if r.status_code == 404:
                if not self._model_checked and self.model == self.cfg.gemini_model:
                    self._switch_model()
                    continue
                raise _Busy(404, f"모델 '{self.model}' 없음")
            msg = ""
            if r.status_code >= 400:
                try:
                    msg = r.json().get("error", {}).get("message", "")
                except ValueError:
                    msg = r.text[:300]
            if r.status_code in (429, 500, 502, 503, 504):
                daily = r.status_code == 429 and "per day" in msg.lower()
                if attempt < retries and not daily:
                    wait = self._retry_delay(r) or delay
                    log.warning("Gemini %d (혼잡/분당 한도) → %.0f초 후 재시도 [%d/%d]", r.status_code, wait,
                                attempt + 1, retries)
                    self.sleep(wait)
                    delay = min(delay * 2, 60)
                    continue
                raise _Busy(r.status_code, msg or r.reason_phrase)
            if r.status_code >= 400:
                raise LLMError(f"Gemini API 오류 {r.status_code}: {msg}")
            return r.json()
        raise _Busy(0, "재시도 횟수 초과")

    def _next_fallback(self, tried: set[str]) -> str | None:
        for m in self.cfg.gemini_fallback_models:
            if m not in tried:
                return m
        try:  # 설정 목록이 다 막히면 계정에서 쓸 수 있는 다른 flash 계열 자동 선택
            names = [n.removeprefix("models/") for n in self.list_models()]
        except httpx.HTTPError:
            return None
        flash = [n for n in names if "flash" in n and n not in tried
                 and not re.search(r"(image|tts|live|audio|embed|exp|preview)", n)]
        return pick_flash_model(flash) or (flash[0] if flash else None)

    @staticmethod
    def _retry_delay(r: httpx.Response) -> float | None:
        try:
            for d in r.json().get("error", {}).get("details", []):
                if "retryDelay" in d:
                    return float(str(d["retryDelay"]).rstrip("s")) + 1
        except Exception:  # noqa: BLE001
            return None
        return None

    def list_models(self) -> list[str]:
        r = self.http.get(f"{API}/models", headers={"x-goog-api-key": self.key}, params={"pageSize": 200})
        r.raise_for_status()
        return [m["name"] for m in r.json().get("models", [])
                if "generateContent" in m.get("supportedGenerationMethods", [])]

    def _switch_model(self) -> None:
        self._model_checked = True
        new = pick_flash_model(self.list_models())
        if not new:
            raise LLMError(f"Gemini 모델 '{self.model}' 을 찾을 수 없고 대체할 flash 모델도 없습니다. 설정에서 모델 이름을 확인하세요.")
        log.warning("Gemini 모델 '%s' 없음 → '%s' 로 자동 전환 (설정에서 바꿀 수 있음)", self.model, new)
        self.model = new

    # ------------------------------------------------------------------ 검색 출처
    def _resolve(self, url: str) -> str:
        """그라운딩 출처는 리다이렉트 주소 → 실제 기사 주소로 변환 (실패 시 원래 값)."""
        if "grounding-api-redirect" not in url:
            return url
        try:
            r = self.http.get(url, follow_redirects=False, timeout=10)
            return r.headers.get("location", url)
        except httpx.HTTPError:
            return url

    # ------------------------------------------------------------------ 인터페이스
    @staticmethod
    def web_search_tool(max_uses: int = 5) -> dict:
        return dict(GOOGLE_SEARCH_TOOL)

    def complete(self, prompt: str, *, system: str | None = None, tools: list[dict] | None = None,
                 json_schema: dict | None = None, max_tokens: int | None = None) -> LLMResult:
        if self.tracker:
            self.tracker.check()
        body: dict[str, Any] = {"contents": [{"role": "user", "parts": [{"text": prompt}]}],
                                "generationConfig": {"maxOutputTokens": max_tokens or self.cfg.max_tokens}}
        if system:
            body["systemInstruction"] = {"parts": [{"text": system}]}
        search = any(t.get("type") == GOOGLE_SEARCH_TOOL["type"] for t in tools or [])
        if search:
            body["tools"] = [{"google_search": {}}]
        if json_schema and not search:
            body["generationConfig"]["responseMimeType"] = "application/json"
            body["generationConfig"]["responseSchema"] = to_gemini_schema(json_schema)
        try:
            data = self._post(body)
        except LLMError as e:
            if json_schema and not search and "400" in str(e):
                log.warning("Gemini 가 응답 스키마를 거부 → 스키마 없이 JSON 모드로 재시도: %s", e)
                body["generationConfig"].pop("responseSchema", None)
                data = self._post(body)
            else:
                raise
        return self._parse(data, search)

    def _parse(self, data: dict, search: bool) -> LLMResult:
        if (fb := data.get("promptFeedback", {})).get("blockReason"):
            raise LLMRefusal(f"Gemini 가 요청을 차단했습니다: {fb['blockReason']}")
        cands = data.get("candidates") or []
        if not cands:
            raise LLMError("Gemini 응답이 비어 있습니다")
        cand = cands[0]
        if cand.get("finishReason") in ("SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII"):
            raise LLMRefusal(f"Gemini 안전 필터로 응답 중단: {cand['finishReason']}")
        text = "".join(p.get("text", "") for p in cand.get("content", {}).get("parts", []) if not p.get("thought"))
        u = data.get("usageMetadata", {})
        itok = u.get("promptTokenCount", 0)
        otok = u.get("candidatesTokenCount", 0) + u.get("thoughtsTokenCount", 0)
        price = self.cfg.gemini_price_per_mtok
        cost = itok / 1e6 * price.get("input", 0) + otok / 1e6 * price.get("output", 0)
        res = LLMResult(text=text, input_tokens=itok, output_tokens=otok, cost_usd=cost,
                        stop_reason=cand.get("finishReason"))
        if search:
            chunks = cand.get("groundingMetadata", {}).get("groundingChunks", [])
            urls = [_SearchResult(self._resolve(c["web"]["uri"]), c["web"].get("title", ""))
                    for c in chunks if c.get("web", {}).get("uri")]
            res.content.append(_SearchBlock(urls))
            res.web_searches = len(cand.get("groundingMetadata", {}).get("webSearchQueries", []))
        if self.tracker:
            self.tracker.add("llm_input_tokens", itok, cost_usd=0)
            self.tracker.add("llm_output_tokens", otok, cost_usd=0)
            self.tracker.add("llm_calls", 1, cost_usd=cost)
            if res.web_searches:
                self.tracker.add("web_searches", res.web_searches, cost_usd=0)
        if cand.get("finishReason") == "MAX_TOKENS" and not text:
            raise LLMError("Gemini 응답이 최대 길이에서 잘렸습니다 (max_tokens 를 늘려 보세요)")
        log.info("Gemini(%s) 호출: in=%d out=%d search=%d", self.model, itok, otok, res.web_searches)
        return res

    def complete_json(self, prompt: str, *, schema: dict | None = None, tools: list[dict] | None = None,
                      system: str | None = None, max_tokens: int | None = None) -> tuple[Any, LLMResult]:
        res = self.complete(prompt, system=system, tools=tools, json_schema=schema, max_tokens=max_tokens)
        return extract_json(res.text), res
