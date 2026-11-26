"""🧒 어린이용 실행 + 구독·좋아요 유도."""
import json

import httpx
import numpy as np
import pytest
from PIL import Image

from agent.collectors.youtube import QuotaManager, YouTubeClient, collect
from agent.config import apply_profile, profile_of
from agent.context import RunContext, today
from agent.pipeline import next_batch, step_cluster, step_research, step_write
from agent.production.visuals import cta_overlay, title_overlay
from agent.publish.youtube_upload import build_body
from agent.writing.script_writer import ensure_cta

from .conftest import NOW, FakeLLM, yt_item


def test_profile_detection_and_overrides(settings):
    assert profile_of("2026-11-26-kids-2") == "kids" and profile_of("2026-11-26-2") == "general"
    k = apply_profile(settings, "kids")
    assert k.profile == "kids" and k.collect.safe_search == "strict" and 27 in k.collect.category_ids
    assert "사고" in k.collect.exclude_keywords and k.script.cta_style == "soft"
    assert settings.profile == "general" and settings.collect.safe_search == ""   # 원본은 그대로
    with RunContext("2026-11-26-kids", settings) as ctx:
        assert ctx.settings.profile == "kids"


def test_kids_batch_names(settings):
    d = today(settings)
    assert next_batch(settings, kids=True) == f"{d}-kids"
    with RunContext(f"{d}-kids", settings):
        pass
    assert next_batch(settings, kids=True) == f"{d}-kids-2"
    assert next_batch(settings) == d


def test_kids_collect_safe_search_and_tolerates_missing_chart(settings):
    calls = []
    items = [yt_item(i, 50_000, 30, title=f"신기한 동물 {i}") for i in range(1, 4)]

    def handler(req):
        p = dict(req.url.params)
        calls.append((req.url.path, p))
        if p.get("chart") == "mostPopular":
            if p.get("videoCategoryId") == "27":
                return httpx.Response(404, json={"error": {"message": "videoChartNotFound"}})
            return httpx.Response(200, json={"items": items})
        if req.url.path.endswith("/search"):
            return httpx.Response(200, json={"items": []})
        return httpx.Response(200, json={"items": []})
    with RunContext("2026-11-25-kids", settings) as ctx:
        yt = YouTubeClient("k", QuotaManager(10000, .8), http=httpx.Client(transport=httpx.MockTransport(handler)))
        vids = collect(ctx, yt, now=NOW)
    assert len(vids) == 3                                       # 조회수 1만+ 기준, 404 카테고리는 건너뜀
    searches = [p for path, p in calls if path.endswith("/search")]
    assert searches and all(p.get("safeSearch") == "strict" and "videoCategoryId" not in p for p in searches)
    assert len(searches) == 5                                   # 검색어 5개 × 카테고리 곱하지 않음 (쿼터 절약)


def test_kids_pipeline_uses_kids_prompts(settings, yt_transport):
    from .test_phase3_analysis import _collect

    class Spy(FakeLLM):
        def __init__(self):
            super().__init__()
            self.prompts = []

        def complete_json(self, prompt, **kw):
            self.prompts.append(prompt)
            return super().complete_json(prompt, **kw)

    settings.collect.min_view_count = 1
    llm = Spy()
    with RunContext("2026-11-25-kids", settings, llm=llm) as ctx:
        ctx.settings.collect.min_view_count = 1
        _collect(ctx, yt_transport)
        step_cluster(ctx)
        step_research(ctx)
        step_write(ctx)
    assert any("5~10살 어린이가 보기 좋고" in p for p in llm.prompts)
    assert any("5~10살 어린이를 위한" in p for p in llm.prompts)
    assert any("다정한 마무리 인사" in p for p in llm.prompts)        # 어린이 기본은 soft


def test_ensure_cta(settings):
    sc = settings.script
    script = {"scenes": [{"narration": "첫 장면"}, {"narration": "정리하면 이렇습니다."}]}
    out = ensure_cta(json.loads(json.dumps(script)), sc)
    assert out["scenes"][-1]["narration"].endswith(sc.cta_text)
    already = {"scenes": [{"narration": "좋아요와 구독 눌러 주세요!"}]}
    assert ensure_cta(already, sc)["scenes"][-1]["narration"] == "좋아요와 구독 눌러 주세요!"
    sc.cta_style = "soft"
    assert "만나요" in ensure_cta(json.loads(json.dumps(script)), sc)["scenes"][-1]["narration"]
    sc.cta_style = "none"
    assert ensure_cta(json.loads(json.dumps(script)), sc)["scenes"][-1]["narration"] == "정리하면 이렇습니다."


def test_cta_overlay_draws_buttons(tmp_path):
    p = tmp_path / "o.png"
    title_overlay("제목", (1080, 1920), p)
    cta_overlay(p, "direct")
    a = np.array(Image.open(p))
    band = a[int(1920 * 0.6): int(1920 * 0.6) + 120]
    red = (band[..., 0] > 200) & (band[..., 1] < 60) & (band[..., 3] > 200)
    assert red.sum() > 1000                                    # 빨간 [▶ 구독] 버튼


def test_upload_body_for_kids():
    body = build_body({"title": "공룡", "made_for_kids": True})
    assert body["status"]["selfDeclaredMadeForKids"] is True and body["snippet"]["categoryId"] == "27"


@pytest.mark.slow
def test_kids_production_marks_made_for_kids(settings, monkeypatch):
    from agent.models import Script, Topic
    from agent.pipeline import produce
    from .test_phase5_production import _sample_script
    settings.production.tts_provider = "dummy"
    settings.production.visual_sources = []
    monkeypatch.setattr("agent.context.RunContext.llm", FakeLLM())
    script = _sample_script(settings)
    with RunContext("2026-11-25-kids", settings) as ctx:
        t = Topic(run_id=ctx.run.id, key="k", title="공룡")
        ctx.session.add(t)
        ctx.session.flush()
        s = Script(topic_id=t.id, json=script, char_count=script["char_count"],
                   est_seconds=script["estimated_seconds"], approval_status="approved")
        ctx.session.add(s)
        ctx.session.commit()
        sid = s.id
    prod = produce(sid, settings=settings)
    assert prod.status == "produced", prod.error
    meta = json.loads((settings.run_dir("2026-11-25-kids") / "production" / f"script_{sid}" / "meta.json")
                      .read_text(encoding="utf-8"))
    assert meta["made_for_kids"] is True and "보호자" in meta["description"] and "구독" not in meta["description"]
    assert meta["bgm"]["mood_analysis"]["mood"] in settings.kids.allowed_moods


# ---------------------------------------------------------------- ⚽ 축구
def test_soccer_profile_and_batch(settings):
    from agent.config import allowed_moods, profile_label, youtube_category
    assert profile_of("2026-11-26-soccer-2") == "soccer" and profile_label("2026-11-26-soccer") == "⚽ 축구"
    s = apply_profile(settings, "soccer")
    assert s.collect.category_ids == [17] and "손흥민" in s.collect.include_keywords and "토토" in s.collect.exclude_keywords
    assert youtube_category(s) == "17" and "upbeat" in allowed_moods(s) and s.script.cta_style == "direct"
    d = today(settings)
    assert next_batch(settings, profile="soccer") == f"{d}-soccer"


def test_soccer_collect_keeps_only_soccer(settings):
    items = [yt_item(1, 90_000, 5, title="손흥민 시즌 10호골 폭발"),
             yt_item(2, 90_000, 5, title="KBO 리그 끝내기 홈런"),            # 야구 → 제외
             yt_item(3, 90_000, 5, title="골프 대회 우승 장면"),               # 골프 → 제외
             yt_item(4, 90_000, 5, title="토토 배당 분석 축구"),               # 도박 → 제외
             yt_item(5, 90_000, 5, title="Champions League 하이라이트", tags=["soccer"])]

    def handler(req):
        p = dict(req.url.params)
        if p.get("chart") == "mostPopular":
            assert p.get("videoCategoryId") == "17"
            return httpx.Response(200, json={"items": items})
        return httpx.Response(200, json={"items": []})
    with RunContext("2026-11-25-soccer", settings) as ctx:
        yt = YouTubeClient("k", QuotaManager(10000, .8), http=httpx.Client(transport=httpx.MockTransport(handler)))
        ids = sorted(v["video_id"] for v in collect(ctx, yt, now=NOW))
    assert ids == ["v1", "v5"]


def test_soccer_uses_soccer_prompts(settings, yt_transport):
    from .test_phase3_analysis import _collect

    class Spy(FakeLLM):
        def __init__(self):
            super().__init__()
            self.prompts = []

        def complete_json(self, prompt, **kw):
            self.prompts.append(prompt)
            if "축구 이슈" in prompt:
                prompt = prompt + "\n같은 이슈"
            if "축구 숏폼 채널의 작가" in prompt:
                prompt = prompt + "\n숏폼 영상 작가"
            return super().complete_json(prompt, **kw)

    llm = Spy()
    with RunContext("2026-11-25-soccer", settings, llm=llm) as ctx:
        ctx.settings.collect.include_keywords = []
        ctx.settings.collect.min_view_count = 1
        _collect(ctx, yt_transport)
        step_cluster(ctx)
        step_research(ctx)
        step_write(ctx)
    assert any("축구 이슈" in p for p in llm.prompts)
    assert any("축구 숏폼 채널의 작가" in p and "토토" in p for p in llm.prompts)
    assert any("좋아요와 구독" in p for p in llm.prompts)


def test_upload_body_uses_profile_category():
    assert build_body({"title": "t", "category_id": "17"})["snippet"]["categoryId"] == "17"
