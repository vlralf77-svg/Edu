"""Phase 1: 설정, DB, LLM 래퍼(재시도·비용 로깅·JSON), 비용 상한."""
from types import SimpleNamespace

import pytest

from agent.config import load_prompt, load_settings
from agent.context import RunContext
from agent.costs import BudgetExceeded, CostTracker
from agent.llm import LLM, LLMRefusal, extract_json
from agent.models import RUN_STEPS


def test_settings_load_defaults_and_override(tmp_path):
    s = load_settings(overrides={"collect": {"min_view_count": 5}, "paths": {"data_dir": str(tmp_path)}})
    assert s.collect.min_view_count == 5
    assert s.collect.region_code == "KR"
    assert s.script.target_chars_ko == 300
    assert s.production.resolution == (1080, 1920)
    assert s.db_url.startswith("sqlite:///") and str(tmp_path) in s.db_url


def test_prompts_exist_and_substitute():
    p = load_prompt("write_script", topic="테스트주제", research="자료", max_seconds=60, min_chars=280, max_chars=320,
                    tone="t", angles="a", feedback="")
    assert "테스트주제" in p and "{topic}" not in p
    for name in ("cluster_topics", "research", "write_script", "fact_check", "mood"):
        assert load_prompt(name)


def test_run_context_creates_run_and_dirs(settings):
    with RunContext("2026-11-25", settings) as ctx:
        assert ctx.run.id and ctx.run_dir.exists()
        ctx.write_json("x/y.json", {"a": "한글"})
        assert ctx.read_json("x/y.json") == {"a": "한글"}
        assert not ctx.step_done("collected")
        ctx.set_status("clustered")
        assert ctx.step_done("collected") and ctx.step_done("clustered") and not ctx.step_done("researched")
    # 같은 날짜로 다시 열면 같은 run
    with RunContext("2026-11-25", settings) as ctx2:
        assert ctx2.run.status == "clustered"
    assert (settings.run_dir("2026-11-25") / "run.log").exists()
    assert RUN_STEPS[0] == "collected"


def test_extract_json_variants():
    assert extract_json('```json\n{"a": 1}\n```') == {"a": 1}
    assert extract_json('검색 결과를 정리했습니다.\n{"a": {"b": "}"}}\n끝') == {"a": {"b": "}"}}
    assert extract_json("[1, 2]") == [1, 2]
    with pytest.raises(Exception):
        extract_json("no json here")


def _resp(text="{}", stop="end_turn", inp=1000, out=500, searches=0, content=None):
    usage = SimpleNamespace(input_tokens=inp, output_tokens=out, cache_creation_input_tokens=0,
                            cache_read_input_tokens=0, server_tool_use=SimpleNamespace(web_search_requests=searches))
    return SimpleNamespace(content=content or [SimpleNamespace(type="text", text=text)], stop_reason=stop, usage=usage)


class FakeClient:
    def __init__(self, responses):
        self.responses = list(responses)
        self.kwargs = []
        self.beta = SimpleNamespace(messages=SimpleNamespace(create=self._create))
        self.messages = SimpleNamespace(create=self._create)

    def _create(self, **kw):
        self.kwargs.append(kw)
        return self.responses.pop(0)


def test_llm_cost_logging_and_fallback_params(settings):
    tracker = CostTracker(10)
    client = FakeClient([_resp('{"ok": true}', searches=2)])
    llm = LLM(settings, tracker, client=client)
    data, res = llm.complete_json("hi", schema={"type": "object"})
    assert data == {"ok": True}
    kw = client.kwargs[0]
    assert kw["model"] == "claude-opus-5-5"
    assert kw["fallbacks"] == "default" and kw["betas"] == ["server-side-fallback-2026-07-01"]
    assert kw["output_config"]["format"]["type"] == "json_schema"
    assert kw["output_config"]["effort"] == "medium"
    # 1000 in * $4/M + 500 out * $20/M + 2 search * $10/1k = 0.004 + 0.01 + 0.02
    assert res.cost_usd == pytest.approx(0.034)
    assert tracker.cost_usd == pytest.approx(0.034)
    assert tracker.usage["llm_input_tokens"] == 1000 and tracker.usage["web_searches"] == 2


def test_llm_with_tools_skips_schema_and_continues_pause_turn(settings):
    client = FakeClient([_resp("", stop="pause_turn"), _resp('결과 ```json\n{"x": 1}\n```')])
    llm = LLM(settings, CostTracker(10), client=client)
    data, res = llm.complete_json("q", schema={"type": "object"}, tools=[LLM.web_search_tool()])
    assert data == {"x": 1}
    assert len(client.kwargs) == 2
    assert "format" not in client.kwargs[0]["output_config"]
    assert client.kwargs[1]["messages"][-1]["role"] == "assistant"


def test_llm_refusal_raises(settings):
    llm = LLM(settings, CostTracker(10), client=FakeClient([_resp("", stop="refusal")]))
    with pytest.raises(LLMRefusal):
        llm.complete("x")


def test_budget_exceeded_blocks_calls(settings):
    tracker = CostTracker(0.01)
    tracker.add("llm_calls", 1, cost_usd=0.02)
    llm = LLM(settings, tracker, client=FakeClient([_resp()]))
    with pytest.raises(BudgetExceeded):
        llm.complete("x")


def test_costs_persist_across_contexts_same_day(settings):
    with RunContext("2026-11-25", settings) as ctx:
        ctx.tracker.add("llm_calls", 1, cost_usd=1.5)
    with RunContext("2026-11-25", settings) as ctx:
        assert ctx.tracker.cost_usd == pytest.approx(1.5)
        assert ctx.run.cost_usd == pytest.approx(1.5)
