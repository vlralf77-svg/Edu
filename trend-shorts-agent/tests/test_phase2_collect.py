"""Phase 2: YouTube 수집 (mock), 쿼터 관리, 필터·중복 제거."""
import httpx
import pytest

from agent.collectors.youtube import QuotaExceeded, QuotaManager, YouTubeClient, collect, parse_duration
from agent.context import RunContext
from agent.models import Run, Topic, Video

from .conftest import NOW


def _client(transport, quota):
    return YouTubeClient("test-key", quota, http=httpx.Client(transport=transport))


def test_parse_duration():
    assert parse_duration("PT1H2M3S") == 3723
    assert parse_duration("PT45S") == 45
    assert parse_duration("P1DT1M") == 86460
    assert parse_duration("") == 0


def test_quota_manager_stops_at_ratio():
    q = QuotaManager(1000, 0.8)
    for _ in range(7):
        q.spend("search.list")
    q.spend("videos.list")
    with pytest.raises(QuotaExceeded):
        q.spend("search.list")  # 701 + 100 > 800
    assert q.used == 701


def test_collect_filters_and_saves(settings, yt_transport):
    with RunContext("2026-11-25", settings) as ctx:
        client = _client(yt_transport, QuotaManager(10000, 0.8))
        vids = collect(ctx, client, now=NOW)
        ids = [v["video_id"] for v in vids]
        # 조회수 미달(v5), 48h 초과(v6), 제외 키워드(v7) 제거, 중복 제거, views/hour 내림차순
        assert ids == ["v2", "v1", "v3", "v4"]
        assert vids[0]["views_per_hour"] == pytest.approx(60000.0)
        assert ctx.session.get(Video, "v1").view_count == 500_000
        assert (ctx.run_dir / "videos.json").exists()
        assert ctx.run.status == "collected"
        # 쿼터: mostPopular 1 + search.list 3*100 + videos.list 1 (v6,v7 만 추가 조회)
        assert ctx.run.quota_used == 302
        chart_call = yt_transport.calls[0][1]
        assert chart_call["chart"] == "mostPopular" and chart_call["regionCode"] == "KR"
        assert yt_transport.calls[1][1]["order"] == "viewCount"


def test_collect_stops_gracefully_on_quota(settings, yt_transport):
    settings.collect.daily_quota = 200  # 한도 160 → search.list 1회(100) 후 다음 호출에서 중단
    with RunContext("2026-11-25", settings) as ctx:
        vids = collect(ctx, _client(yt_transport, QuotaManager(1, 1)), now=NOW)
        assert ctx.run.quota_used == 101
        assert {v["video_id"] for v in vids} == {"v1", "v2", "v3", "v4"}


def test_collect_excludes_recently_processed(settings, yt_transport):
    with RunContext("2026-11-23", settings) as old:
        v = Video(video_id="v1", title="x")
        old.session.add(v)
        t = Topic(run_id=old.run.id, key="old", title="old")
        t.videos = [v]
        old.session.add(t)
        old.session.commit()
    with RunContext("2026-11-25", settings) as ctx:
        ids = [v["video_id"] for v in collect(ctx, _client(yt_transport, QuotaManager(10000, 0.8)), now=NOW)]
        assert "v1" not in ids and "v2" in ids


def test_shorts_excluded_when_disabled(settings, yt_transport):
    settings.collect.include_shorts = False
    from .conftest import DEFAULT_ITEMS
    DEFAULT_ITEMS[1]["contentDetails"]["duration"] = "PT45S"
    try:
        with RunContext("2026-11-25", settings) as ctx:
            ids = [v["video_id"] for v in collect(ctx, _client(yt_transport, QuotaManager(10000, 0.8)), now=NOW)]
        assert "v2" not in ids
    finally:
        DEFAULT_ITEMS[1]["contentDetails"]["duration"] = "PT5M"
