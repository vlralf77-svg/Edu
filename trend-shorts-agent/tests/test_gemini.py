"""Gemini(무료 등급) LLM: 요청 형식, JSON 스키마, 구글 검색 출처, 404 모델 자동 전환, 429 재시도, 차단 처리."""
import json

import httpx
import pytest

from agent.analysis.research import research_topic
from agent.context import RunContext
from agent.costs import CostTracker
from agent.llm import LLMError, LLMRefusal, make_llm
from agent.llm_gemini import GeminiLLM, pick_flash_model, to_gemini_schema


def ok(text, **extra):
    cand = {"content": {"parts": [{"text": "생각중", "thought": True}, {"text": text}]}, "finishReason": "STOP", **extra}
    return {"candidates": [cand], "usageMetadata": {"promptTokenCount": 100, "candidatesTokenCount": 50,
                                                     "thoughtsTokenCount": 20}}


class Server:
    """요청을 기록하고 준비된 응답을 순서대로 돌려주는 가짜 Gemini."""

    def __init__(self, responses, models=None, redirects=None):
        self.responses = list(responses)
        self.requests = []
        self.models = models or []
        self.redirects = redirects or {}

    def __call__(self, req: httpx.Request):
        if "grounding-api-redirect" in str(req.url):
            return httpx.Response(302, headers={"location": self.redirects[str(req.url)]})
        if req.url.path.endswith("/models") and req.method == "GET":
            return httpx.Response(200, json={"models": [
                {"name": f"models/{m}", "supportedGenerationMethods": ["generateContent"]} for m in self.models]})
        self.requests.append((str(req.url), json.loads(req.content), req.headers.get("x-goog-api-key")))
        status, body = self.responses.pop(0)
        return httpx.Response(status, json=body)


@pytest.fixture
def gem(settings, monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "g-key")

    def make(server, tracker=None):
        return GeminiLLM(settings, tracker, http=httpx.Client(transport=httpx.MockTransport(server)),
                         sleep=lambda s: None)
    return make


def test_defaults_to_gemini_and_requires_key(settings, monkeypatch):
    assert settings.llm.provider == "gemini" and settings.research.provider == "llm"
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    with pytest.raises(LLMError, match="aistudio"):
        make_llm(settings)


def test_schema_conversion():
    s = to_gemini_schema({"type": "object", "additionalProperties": False, "required": ["a"],
                          "properties": {"a": {"type": "array", "items": {"type": "integer"}},
                                         "b": {"type": "string", "enum": ["x"]}}})
    assert s == {"type": "OBJECT", "required": ["a"], "propertyOrdering": ["a", "b"],
                 "properties": {"a": {"type": "ARRAY", "items": {"type": "INTEGER"}},
                                "b": {"type": "STRING", "enum": ["x"]}}}


def test_json_request_and_usage(gem):
    srv = Server([(200, ok('{"x": 1}'))])
    tracker = CostTracker(1)
    data, res = gem(srv, tracker).complete_json("질문", schema={"type": "object", "properties": {"x": {"type": "integer"}}},
                                                system="시스템")
    assert data == {"x": 1}
    url, body, key = srv.requests[0]
    assert url.endswith("/models/gemini-flash-latest:generateContent") and key == "g-key"
    assert body["generationConfig"]["responseMimeType"] == "application/json"
    assert body["generationConfig"]["responseSchema"]["type"] == "OBJECT"
    assert body["systemInstruction"]["parts"][0]["text"] == "시스템"
    assert res.input_tokens == 100 and res.output_tokens == 70 and res.cost_usd == 0
    assert tracker.usage["llm_calls"] == 1 and tracker.cost_usd == 0


def test_schema_rejected_then_retry_without(gem):
    srv = Server([(400, {"error": {"message": "Invalid JSON payload: responseSchema"}}), (200, ok('{"y": 2}'))])
    data, _ = gem(srv).complete_json("q", schema={"type": "object"})
    assert data == {"y": 2}
    assert "responseSchema" in srv.requests[0][1]["generationConfig"]
    assert "responseSchema" not in srv.requests[1][1]["generationConfig"]


def test_google_search_grounding_resolves_sources(gem):
    redir = "https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc"
    grounding = {"groundingMetadata": {"webSearchQueries": ["q1", "q2"], "groundingChunks": [
        {"web": {"uri": redir, "title": "yna.co.kr"}}, {"web": {"uri": "https://gov.kr/b", "title": "gov.kr"}}]}}
    srv = Server([(200, ok('```json\n{"sources": []}\n```', **grounding))],
                 redirects={redir: "https://www.yna.co.kr/view/AKR1"})
    llm = gem(srv)
    data, res = llm.complete_json("조사", schema={"type": "object"}, tools=[llm.web_search_tool()])
    body = srv.requests[0][1]
    assert body["tools"] == [{"google_search": {}}]
    assert "responseSchema" not in body["generationConfig"]   # 검색 툴과 스키마는 함께 쓰지 않음
    block = res.content[0]
    assert block.type == "web_search_tool_result"
    assert [r.url for r in block.content] == ["https://www.yna.co.kr/view/AKR1", "https://gov.kr/b"]
    assert res.web_searches == 2


def test_model_404_switches_to_available_flash(gem):
    srv = Server([(404, {"error": {"message": "model not found"}}), (200, ok('{"a": 1}'))],
                 models=["gemini-9.0-flash", "gemini-9.5-flash-lite", "gemini-9.5-pro", "gemini-9.5-flash-preview-01",
                         "gemini-9.5-flash"])
    llm = gem(srv)
    data, _ = llm.complete_json("q")
    assert data == {"a": 1} and llm.model == "gemini-9.5-flash"
    assert srv.requests[1][0].endswith("/models/gemini-9.5-flash:generateContent")


def test_pick_flash_model():
    assert pick_flash_model(["models/gemini-2.0-flash", "models/gemini-2.5-flash", "models/gemini-2.5-flash-lite"]) \
        == "gemini-2.5-flash"
    assert pick_flash_model(["models/gemini-2.5-pro"]) is None


def test_rate_limit_retry_then_success(gem):
    srv = Server([(429, {"error": {"message": "quota", "details": [{"retryDelay": "7s"}]}}), (200, ok('{"z": 3}'))])
    waits = []
    llm = gem(srv)
    llm.sleep = waits.append
    data, _ = llm.complete_json("q")
    assert data == {"z": 3} and 8.0 in waits


DAY_429 = (429, {"error": {"message": "You exceeded your current quota. Quota exceeded for metric: "
                                      "generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 20",
                           "details": [{"@type": "type.googleapis.com/google.rpc.QuotaFailure", "violations": [
                               {"quotaId": "GenerateRequestsPerDayPerProjectPerModel-FreeTier", "quotaValue": "20"}]},
                               {"@type": "type.googleapis.com/google.rpc.RetryInfo", "retryDelay": "39s"}]}})
MIN_429 = (429, {"error": {"message": "quota", "details": [{"violations": [
    {"quotaId": "GenerateRequestsPerMinutePerProjectPerModel-FreeTier"}]}, {"retryDelay": "12s"}]}})


def test_classify_429():
    from agent.llm_gemini import classify_429
    assert classify_429(httpx.Response(429, json=DAY_429[1]))[0] == "day"
    assert classify_429(httpx.Response(429, json=MIN_429[1]))[:1] == ("minute",)
    assert classify_429(httpx.Response(429, json=MIN_429[1]))[2] == 13.0
    assert classify_429(httpx.Response(429, json={"error": {"message": "x limit: 0, model: m"}}))[0] == "day"


def test_daily_quota_exhausted_everywhere_stops_fast(gem, settings):
    srv = Server([DAY_429, DAY_429], models=["gemini-flash-latest", "gemini-flash-lite-latest"])
    waits = []
    llm = gem(srv)
    llm.sleep = waits.append
    with pytest.raises(LLMError, match="무료 한도를 모두 사용") as e:
        llm.complete("q")
    assert "초기화" in str(e.value) and len(srv.requests) == 2      # 모델당 1번씩만, 재시도 대기 없음
    assert all(w < 14 for w in waits)                                # 호출 간격 외에 긴 대기 없음
    # 같은 날 새로 실행해도 구글에 다시 묻지 않고 바로 안내
    srv2 = Server([], models=["gemini-flash-latest", "gemini-flash-lite-latest"])
    with pytest.raises(LLMError, match="무료 한도를 모두 사용"):
        gem(srv2).complete("q")
    assert srv2.requests == []


def test_exhausted_model_remembered_next_run(gem, settings):
    srv = Server([DAY_429, (200, ok('{"a": 1}'))], models=["gemini-flash-latest", "gemini-flash-lite-latest"])
    assert gem(srv).complete_json("q")[0] == {"a": 1}
    srv2 = Server([(200, ok('{"b": 2}'))], models=["gemini-flash-latest", "gemini-flash-lite-latest"])
    llm2 = gem(srv2)
    assert llm2.complete_json("q")[0] == {"b": 2}
    assert len(srv2.requests) == 1 and "flash-lite-latest" in srv2.requests[0][0]


def test_per_minute_limit_waits_and_retries_same_model(gem):
    srv = Server([MIN_429, (200, ok('{"m": 1}'))])
    waits = []
    llm = gem(srv)
    llm.sleep = waits.append
    assert llm.complete_json("q")[0] == {"m": 1} and 13.0 in waits
    assert srv.requests[0][0] == srv.requests[1][0]


def test_overloaded_switches_to_fallback_model(gem, settings):
    settings.llm.gemini_retries = 2
    busy = (503, {"error": {"message": "This model is currently experiencing high demand."}})
    srv = Server([busy, busy, busy, (200, ok('{"ok": true}'))])
    llm = gem(srv)
    data, _ = llm.complete_json("q")
    assert data == {"ok": True} and llm.model == "gemini-flash-lite-latest"
    assert [u.split("/models/")[1].split(":")[0] for u, _, _ in srv.requests] == \
        ["gemini-flash-latest"] * 3 + ["gemini-flash-lite-latest"]
    # 이후 호출은 전환된 모델 유지
    srv.responses.append((200, ok('{"x": 1}')))
    llm.complete_json("q2")
    assert "gemini-flash-lite-latest" in srv.requests[-1][0]


def test_daily_quota_on_one_model_uses_another(gem, settings):
    srv = Server([(429, {"error": {"message": "Quota exceeded for metric: requests per day"}}), (200, ok('{"a": 1}'))])
    llm = gem(srv)
    assert llm.complete_json("q")[0] == {"a": 1} and llm.model == "gemini-flash-lite-latest"
    assert len(srv.requests) == 2                      # 하루 한도는 같은 모델 재시도 없이 바로 전환


def test_all_models_busy_gives_friendly_message(gem, settings):
    settings.llm.gemini_retries = 0
    busy = (503, {"error": {"message": "high demand"}})
    srv = Server([busy] * 5, models=["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"])
    with pytest.raises(LLMError, match="혼잡") as e:
        gem(srv).complete("q")
    assert "gemini-2.0-flash" in str(e.value)


def test_blocked_prompt_is_refusal(gem):
    with pytest.raises(LLMRefusal):
        gem(Server([(200, {"promptFeedback": {"blockReason": "SAFETY"}})])).complete("q")
    with pytest.raises(LLMRefusal):
        gem(Server([(200, {"candidates": [{"finishReason": "SAFETY", "content": {"parts": []}}]})])).complete("q")


def test_research_with_gemini_search_filters_unverified_urls(gem, settings):
    redir = "https://vertexaisearch.cloud.google.com/grounding-api-redirect/r1"
    payload = {"sources": [
        {"url": "https://www.yna.co.kr/view/AKR1", "title": "기사", "publisher": "연합", "published_date": "", "facts": ["A"]},
        {"url": "https://gov.kr/b", "title": "발표", "publisher": "정부", "published_date": "", "facts": ["B"]},
        {"url": "https://invented.example/x", "title": "?", "publisher": "", "published_date": "", "facts": ["C"]}],
        "key_facts": ["A", "B"], "contradictions": [], "confidence": "high"}
    grounding = {"groundingMetadata": {"webSearchQueries": ["q"], "groundingChunks": [
        {"web": {"uri": redir, "title": "yna.co.kr"}}, {"web": {"uri": "https://gov.kr/b", "title": "gov.kr"}}]}}
    srv = Server([(200, ok(json.dumps(payload, ensure_ascii=False), **grounding))],
                 redirects={redir: "https://www.yna.co.kr/view/AKR1"})
    with RunContext("2026-11-25", settings, llm=gem(srv)) as ctx:
        data = research_topic(ctx, {"title": "주제", "summary": "요약", "angle_ideas": []})
    assert [s["url"] for s in data["sources"]] == ["https://www.yna.co.kr/view/AKR1", "https://gov.kr/b"]
    assert data["confidence"] == "high"


def test_new_key_resets_exhausted_memory(gem, settings, monkeypatch):
    srv = Server([DAY_429, DAY_429], models=["gemini-flash-latest", "gemini-flash-lite-latest"])
    with pytest.raises(LLMError):
        gem(srv).complete("q")
    monkeypatch.setenv("GEMINI_API_KEY", "new-key")          # 키를 새로 발급해 교체
    srv2 = Server([(200, ok('{"ok": 1}'))], models=["gemini-flash-latest", "gemini-flash-lite-latest"])
    assert gem(srv2).complete_json("q")[0] == {"ok": 1}
    assert "new-key" not in (settings.data_dir / "gemini_quota.json").read_text(encoding="utf-8")
