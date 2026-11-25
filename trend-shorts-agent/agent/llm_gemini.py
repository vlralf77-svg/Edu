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

    def __init__(self, status: int, msg: str, kind: str = ""):
        super().__init__(msg)
        self.status = status
        self.kind = kind


def classify_429(r: httpx.Response) -> tuple[str, str, float | None]:
    """429 응답 분류 → ("day" 하루 한도 | "minute" 분당 한도 | "unknown", 구글 메시지, 재시도 대기초)."""
    try:
        err = r.json().get("error", {})
    except ValueError:
        return "unknown", r.text[:300], None
    msg = err.get("message", "")
    kind, delay = "unknown", None
    for d in err.get("details", []):
        if "retryDelay" in d:
            try:
                delay = float(str(d["retryDelay"]).rstrip("s")) + 1
            except ValueError:
                pass
        for v in d.get("violations", []):
            qid = (v.get("quotaId", "") + " " + v.get("quotaMetric", "")).lower()
            if "perday" in qid or "per_day" in qid:
                kind = "day"
            elif kind != "day" and ("perminute" in qid or "per_minute" in qid):
                kind = "minute"
    low = msg.lower()
    if kind == "unknown":
        if "per day" in low or "perday" in low:
            kind = "day"
        elif "per minute" in low or "perminute" in low:
            kind = "minute"
    if re.search(r"limit:\s*0\b", low):  # 이 모델은 무료 한도 자체가 0
        kind = "day"
    return kind, msg, delay


def quota_day() -> str:
    """구글 무료 한도는 미국 태평양 시간 자정에 초기화."""
    from datetime import datetime
    from zoneinfo import ZoneInfo
    return datetime.now(ZoneInfo("America/Los_Angeles")).strftime("%Y-%m-%d")


def reset_time_kst() -> str:
    from datetime import datetime, timedelta
    from zoneinfo import ZoneInfo
    la = ZoneInfo("America/Los_Angeles")
    now = datetime.now(la)
    nxt = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return nxt.astimezone(ZoneInfo("Asia/Seoul")).strftime("%m월 %d일 %H시")


class QuotaBook:
    """오늘(태평양 시간 기준) 하루 한도가 끝난 모델·없는 모델을 기억해서 다시 시도하느라 시간 낭비하지 않게."""

    def __init__(self, path, key: str = ""):
        import hashlib
        self.path = path
        self.key_id = hashlib.sha256(key.encode()).hexdigest()[:12]  # 키가 바뀌면 기록 초기화 (키 자체는 저장 안 함)

    def _load(self) -> dict:
        import json
        try:
            data = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            data = {}
        if data.get("key") != self.key_id:
            data = {"day": quota_day(), "key": self.key_id, "exhausted": [], "missing": []}
        elif data.get("day") != quota_day():
            data = {"day": quota_day(), "key": self.key_id, "exhausted": [], "missing": data.get("missing", [])}
        return data

    def blocked(self, model: str) -> bool:
        d = self._load()
        return model in d["exhausted"] or model in d["missing"]

    def mark(self, model: str, kind: str) -> None:
        import json
        d = self._load()
        key = "missing" if kind == "missing" else "exhausted"
        if model not in d[key]:
            d[key].append(model)
        try:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            self.path.write_text(json.dumps(d, ensure_ascii=False), encoding="utf-8")
        except OSError:
            pass


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
        self._models: list[str] | None = None
        self.book = QuotaBook(settings.data_dir / "gemini_quota.json", self.key)

    # ------------------------------------------------------------------ HTTP
    def _throttle(self) -> None:
        with self._lock:
            wait = self.cfg.gemini_min_interval_sec - (time.monotonic() - self._last_call)
            if wait > 0:
                self.sleep(wait)
            self._last_call = time.monotonic()

    def _candidates(self) -> list[str]:
        """시도 순서: 지금 모델 → 설정의 대체 모델 → 계정에서 쓸 수 있는 flash 계열(최신 버전 우선)."""
        order = [self.model, self.cfg.gemini_model, *self.cfg.gemini_fallback_models]
        if self._models is None:
            try:
                self._models = [n.removeprefix("models/") for n in self.list_models()]
            except httpx.HTTPError:
                self._models = []
        flash = [n for n in self._models if "flash" in n
                 and not re.search(r"(image|tts|live|audio|embed|exp|preview|thinking)", n)]

        def ver(n):
            return tuple(int(x) for x in re.findall(r"(\d+)", n.split("flash")[0])) or (0,)
        order += sorted(flash, key=lambda n: (ver(n), "lite" not in n), reverse=True)
        out = []
        for m in order:
            if m and m not in out and not (self._models and m not in self._models and m != self.model):
                out.append(m)
        return out

    def _post(self, body: dict) -> dict:
        """모델별로 시도. 하루 한도가 끝난 모델은 즉시 건너뛰고(오늘 하루 기억), 모두 끝나면 바로 중단."""
        tried: list[str] = []
        last: _Busy | None = None
        search = "tools" in body  # 구글 검색 한도는 일반 호출 한도와 별개로 기록
        tag = "#search" if search else ""
        for model in self._candidates():
            if self.book.blocked(model + tag) or self.book.blocked(model):
                continue
            if search and len(tried) >= 2:  # 검색은 빨리 포기하고 뉴스 RSS 로 넘어가게
                break
            if model != self.model:
                log.warning("Gemini 모델 전환: '%s' → '%s'", self.model, model)
                self.model = model
            tried.append(model)
            try:
                return self._post_model(body, retries=1 if search else None)
            except _Busy as e:
                last = e
                if e.status == 404:
                    self.book.mark(model, "missing")
                elif e.kind == "day":
                    self.book.mark(model + tag, "day")
                    log.warning("Gemini '%s' 오늘 무료 한도 소진 → 다른 모델 시도 (구글 메시지: %s)", model, e)
        if search:
            raise LLMError(f"Gemini 구글 검색 사용 불가 ({getattr(last, 'status', '')}: {last})")
        if last is None or (last.status == 429 and not any(not self.book.blocked(m) for m in self._candidates())):
            raise LLMError(
                f"오늘 Gemini 무료 한도를 모두 사용했습니다. 구글 무료 한도는 {reset_time_kst()}(한국 시간)에 초기화됩니다. "
                "그 이후 다시 실행하면 끝난 단계는 건너뛰고 이어서 진행합니다. "
                "자주 걸리면 설정에서 하루 주제 수를 2~3개로 줄이세요."
                + (f" (구글 메시지: {last})" if last else ""))
        hint = (" — 구글 무료 서버가 혼잡합니다. 10~30분 뒤 다시 실행하면 이어서 진행합니다." if last.status >= 500
                else "")
        raise LLMError(f"Gemini API 오류 {last.status}: {last}{hint} (시도한 모델: {', '.join(tried)})")

    def _post_model(self, body: dict, retries: int | None = None) -> dict:
        delay = 5.0
        retries = self.cfg.gemini_retries if retries is None else retries
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
                raise _Busy(404, f"모델 '{self.model}' 없음")
            if r.status_code == 429:
                kind, msg, wait = classify_429(r)
                if kind == "day":
                    raise _Busy(429, msg or "하루 한도 초과", kind="day")
                if attempt < retries:
                    wait = wait or max(delay, 15)
                    log.warning("Gemini 429 분당 한도 → %.0f초 후 재시도 [%d/%d] (구글: %s)", wait, attempt + 1, retries,
                                msg[:150])
                    self.sleep(wait)
                    delay = min(delay * 2, 60)
                    continue
                raise _Busy(429, msg, kind=kind)
            if r.status_code in (500, 502, 503, 504):
                if attempt < min(retries, 1):  # 혼잡은 모델 전체 문제라 1번만 재시도하고 다른 모델로
                    log.warning("Gemini %d (서버 혼잡) → %.0f초 후 1번 더 시도, 안 되면 다른 모델로 (구글: %s)",
                                r.status_code, delay, self._msg(r)[:120])
                    self.sleep(delay)
                    delay = min(delay * 2, 60)
                    continue
                raise _Busy(r.status_code, self._msg(r))
            if r.status_code >= 400:
                raise LLMError(f"Gemini API 오류 {r.status_code}: {self._msg(r)}")
            return r.json()
        raise _Busy(0, "재시도 횟수 초과")

    @staticmethod
    def _msg(r: httpx.Response) -> str:
        try:
            return r.json().get("error", {}).get("message", "") or r.reason_phrase
        except ValueError:
            return r.text[:300]

    def list_models(self) -> list[str]:
        r = self.http.get(f"{API}/models", headers={"x-goog-api-key": self.key}, params={"pageSize": 200})
        r.raise_for_status()
        return [m["name"] for m in r.json().get("models", [])
                if "generateContent" in m.get("supportedGenerationMethods", [])]

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


def probe_models(settings: Settings, http: httpx.Client | None = None, limit: int = 8) -> list[dict]:
    """AI 연결 테스트: 모델마다 짧은 질문 1번(재시도 없음) → 결과·구글 원문 메시지. 성공 모델 목록 반환."""
    llm = GeminiLLM(settings, http=http)
    out = []
    try:
        llm._models = [n.removeprefix("models/") for n in llm.list_models()]
    except httpx.HTTPStatusError as e:
        return [{"model": "(모델 목록)", "ok": False, "status": e.response.status_code,
                 "message": GeminiLLM._msg(e.response)}]
    except httpx.HTTPError as e:
        return [{"model": "(모델 목록)", "ok": False, "status": 0, "message": f"인터넷 연결 실패: {e}"}]
    body = {"contents": [{"role": "user", "parts": [{"text": "한 단어로 답하세요: 안녕"}]}],
            "generationConfig": {"maxOutputTokens": 64}}
    for model in llm._candidates()[:limit]:
        try:
            r = llm.http.post(f"{API}/models/{model}:generateContent", json=body, headers={"x-goog-api-key": llm.key})
        except httpx.HTTPError as e:
            out.append({"model": model, "ok": False, "status": 0, "message": str(e)})
            continue
        msg = "" if r.status_code == 200 else GeminiLLM._msg(r)
        if r.status_code == 429:
            msg = f"[{classify_429(r)[0]}] {msg}"
        out.append({"model": model, "ok": r.status_code == 200, "status": r.status_code, "message": msg[:300]})
        time.sleep(1.5)
    return out
