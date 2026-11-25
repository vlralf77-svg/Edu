"""Phase 3: 클러스터링, 조사, 대본(길이 검증·재작성), 팩트체크, shortlist."""
import httpx

from agent.analysis.clustering import parse_clusters, score_topics
from agent.analysis.research import finalize
from agent.collectors.youtube import QuotaManager, YouTubeClient
from agent.context import RunContext
from agent.models import Script, Topic
from agent.pipeline import step_cluster, step_collect, step_research, step_shortlist, step_write
from agent.writing.fact_checker import rule_flags
from agent.writing.script_writer import char_count, length_ok

from .conftest import NOW, FakeLLM


def _collect(ctx, transport):
    from agent.collectors.youtube import collect
    return collect(ctx, YouTubeClient("k", QuotaManager(10000, .8), http=httpx.Client(transport=transport)), now=NOW)


def test_parse_clusters_validates_ids_and_excludes():
    videos = [{"video_id": f"v{i}", "view_count": 1, "views_per_hour": 1} for i in range(3)]
    data = {"topics": [
        {"topic_id": "A B", "title": "a", "summary": "", "related_video_ids": ["v0", "zz"], "fitness": 7,
         "angle_ideas": [], "excluded": False},
        {"topic_id": "A B", "title": "dup", "summary": "", "related_video_ids": ["v0", "v1"], "fitness": 0,
         "angle_ideas": [], "excluded": False},
        {"topic_id": "x", "title": "x", "summary": "", "related_video_ids": ["v2"], "fitness": 3,
         "angle_ideas": [], "excluded": True, "exclude_reason": "루머"},
    ]}
    kept, excl = parse_clusters(data, videos, 1)
    assert kept[0]["topic_id"] == "a-b" and kept[0]["related_video_ids"] == ["v0"] and kept[0]["fitness"] == 5
    assert kept[1]["topic_id"] == "a-b-x" and kept[1]["related_video_ids"] == ["v1"] and kept[1]["fitness"] == 1
    assert excl[0]["exclude_reason"] == "루머"


def test_score_orders_by_weighted_sum():
    videos = [{"video_id": "a", "view_count": 1_000_000, "views_per_hour": 50_000},
              {"video_id": "b", "view_count": 100_000, "views_per_hour": 2_000}]
    topics = [{"related_video_ids": ["b"], "fitness": 5}, {"related_video_ids": ["a"], "fitness": 5}]
    out = score_topics(topics, videos, {"total_views": .35, "views_per_hour": .35, "video_count": .1, "fitness": .2})
    assert out[0]["related_video_ids"] == ["a"] and out[0]["score"] > out[1]["score"]
    assert out[0]["score"] == 100.0


def test_research_finalize_confidence_and_url_filter():
    data = {"sources": [{"url": "https://a.com/1", "facts": []}, {"url": "https://a.com/2", "facts": []},
                        {"url": "https://youtu.be/x", "facts": []}], "contradictions": [], "confidence": "high"}
    out = finalize(data, 2)
    assert len(out["sources"]) == 2 and out["confidence"] == "low"  # 도메인 1개뿐
    data = {"sources": [{"url": "https://a.com/1"}, {"url": "https://b.com/2"}], "contradictions": ["x"],
            "confidence": "high"}
    assert finalize(data, 2)["confidence"] == "low"  # 모순
    data = {"sources": [{"url": "https://a.com/1"}, {"url": "https://b.com/2"}], "contradictions": []}
    assert finalize(data, 2, allowed_urls={"https://a.com/1"})["sources"] == [{"url": "https://a.com/1"}]


def test_length_check():
    assert length_ok(300, 300) and length_ok(329, 300) and not length_ok(331, 300) and not length_ok(230, 300)


def test_rule_flags():
    kinds = {f["type"] for f in rule_flags("지금 사야 합니다. 이 약 복용하세요. 그 사람은 사기꾼")}
    assert kinds == {"investment", "medical", "defamation"}
    assert rule_flags("오늘 날씨는 맑습니다") == []


def test_analysis_pipeline_end_to_end(settings, yt_transport):
    llm = FakeLLM(script_lengths=(420, 300))  # 첫 대본은 너무 길어서 재작성
    with RunContext("2026-11-25", settings, llm=llm) as ctx:
        _collect(ctx, yt_transport)
        topics = step_cluster(ctx)
        assert [t["topic_id"] for t in topics] == ["ai-phone", "baseball"]
        assert (ctx.run_dir / "topics_excluded.json").exists()

        step_research(ctx)
        r = ctx.read_json("research/ai-phone.json")
        urls = [s["url"] for s in r["sources"]]
        assert urls == ["https://news.example.com/a", "https://gov.example.kr/b"]  # 지어낸 URL·유튜브 제거
        assert r["confidence"] == "high"

        step_write(ctx)
        assert llm.calls.count("write") == 3  # 주제1: 420자→재작성→300자 / 주제2: 300자
        rows = ctx.session.query(Script).all()
        checked = [s for s in rows if s.approval_status == "pending_review"]
        assert len(checked) == 2
        for s in checked:
            assert 270 <= s.char_count <= 330 and s.est_seconds <= 60
            assert len(s.json["title"]) <= 40
            assert s.json["hashtags"] == ["#AI", "#폰"]
            assert s.json["sources"] == ["https://news.example.com/a"]  # 조사에 없는 URL 제거
            assert all(len(sc["on_screen_text"]) <= 12 for sc in s.json["scenes"])

        path, approved = step_shortlist(ctx)
        md = path.read_text(encoding="utf-8")
        assert "AI 폰 공개" in md and "script_id" in md and "https://youtu.be/v" in md
        assert approved == []  # require_approval=true 기본
        assert ctx.run.status == "pending_review"
        assert ctx.run.cost_usd == 0  # FakeLLM 은 비용 없음


def test_low_confidence_and_risk_flags(settings, yt_transport):
    llm = FakeLLM(fact_flags=[{"type": "defamation", "sentence": "x", "note": "y"}])
    with RunContext("2026-11-25", settings, llm=llm) as ctx:
        _collect(ctx, yt_transport)
        step_cluster(ctx)
        step_research(ctx)
        t = ctx.session.query(Topic).filter_by(key="baseball").one()
        t.confidence = "low"
        step_write(ctx)
        s = max(t.scripts, key=lambda s: s.version)
        assert set(s.risk_flags) == {"defamation", "low_confidence"}


def test_idempotent_rerun_skips_completed_steps(settings, yt_transport):
    llm = FakeLLM()
    with RunContext("2026-11-25", settings, llm=llm) as ctx:
        _collect(ctx, yt_transport)
        step_cluster(ctx)
        step_research(ctx)
        step_write(ctx)
    n_calls = len(llm.calls)
    with RunContext("2026-11-25", settings, llm=llm) as ctx:
        step_collect(ctx)
        step_cluster(ctx)
        step_research(ctx)
        step_write(ctx)
    assert len(llm.calls) == n_calls  # 아무 것도 다시 호출하지 않음
    with RunContext("2026-11-25", settings, llm=llm) as ctx:
        step_cluster(ctx, force=True)
    assert llm.calls[-1] == "cluster"
