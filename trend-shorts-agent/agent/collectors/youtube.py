"""Step 1. YouTube 트렌드 영상 수집 (메타데이터만 — 영상·음원·썸네일은 절대 다운로드하지 않음)."""
from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Iterable

import httpx
from sqlalchemy import select
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

from ..config import env
from ..models import Run, Topic, Video, topic_videos

log = logging.getLogger(__name__)
API = "https://www.googleapis.com/youtube/v3"
QUOTA_COST = {"videos.list": 1, "search.list": 100}


class QuotaExceeded(RuntimeError):
    pass


def _retryable(e: BaseException) -> bool:
    if isinstance(e, httpx.HTTPStatusError):
        return e.response.status_code in (429, 500, 502, 503, 504)
    return isinstance(e, httpx.TransportError)


class QuotaManager:
    """일일 쿼터(유닛) 관리. 한도의 stop_ratio 를 넘으면 더 이상 호출하지 않는다."""

    def __init__(self, daily_quota: int, stop_ratio: float, used: int = 0):
        self.limit = int(daily_quota * stop_ratio)
        self.used = used

    def spend(self, method: str) -> None:
        cost = QUOTA_COST[method]
        if self.used + cost > self.limit:
            raise QuotaExceeded(f"쿼터 한도 도달: {self.used}+{cost} > {self.limit}")
        self.used += cost
        log.info("쿼터 사용 %s +%d → %d/%d", method, cost, self.used, self.limit)


class YouTubeClient:
    def __init__(self, api_key: str, quota: QuotaManager, http: httpx.Client | None = None):
        if not api_key:
            raise RuntimeError("YOUTUBE_API_KEY 가 설정되지 않았습니다 (.env)")
        self.key = api_key
        self.quota = quota
        self.http = http or httpx.Client(timeout=20)

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10), retry=retry_if_exception(_retryable),
           reraise=True)
    def _get(self, path: str, params: dict) -> dict:
        r = self.http.get(f"{API}/{path}", params={**params, "key": self.key})
        r.raise_for_status()
        return r.json()

    def call(self, method: str, params: dict) -> dict:
        self.quota.spend(method)
        return self._get(method.split(".")[0], params)

    def most_popular(self, region: str, category_id: int | None = None, max_results: int = 50) -> list[dict]:
        params = {"part": "snippet,statistics,contentDetails", "chart": "mostPopular", "regionCode": region,
                  "maxResults": min(max_results, 50)}
        if category_id:
            params["videoCategoryId"] = category_id
        return self.call("videos.list", params).get("items", [])

    def search_ids(self, published_after: datetime, region: str, lang: str, query: str | None = None,
                   category_id: int | None = None, max_results: int = 50, safe_search: str = "") -> list[str]:
        params = {"part": "id", "type": "video", "order": "viewCount", "regionCode": region,
                  "relevanceLanguage": lang, "maxResults": min(max_results, 50),
                  "publishedAfter": published_after.strftime("%Y-%m-%dT%H:%M:%SZ")}
        if query:
            params["q"] = query
        if safe_search:
            params["safeSearch"] = safe_search
        if category_id:
            params["videoCategoryId"] = category_id
        items = self.call("search.list", params).get("items", [])
        return [it["id"]["videoId"] for it in items if it.get("id", {}).get("videoId")]

    def videos(self, ids: Iterable[str]) -> list[dict]:
        ids = list(dict.fromkeys(ids))
        out: list[dict] = []
        for i in range(0, len(ids), 50):
            out += self.call("videos.list", {"part": "snippet,statistics,contentDetails",
                                             "id": ",".join(ids[i:i + 50])}).get("items", [])
        return out


# ---------------------------------------------------------------- 변환/필터
_DUR = re.compile(r"P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?")


def parse_duration(iso: str) -> int:
    m = _DUR.fullmatch(iso or "")
    if not m:
        return 0
    d, h, mi, s = (int(x or 0) for x in m.groups())
    return d * 86400 + h * 3600 + mi * 60 + s


def normalize(item: dict, now: datetime) -> dict:
    sn, st = item.get("snippet", {}), item.get("statistics", {})
    pub = datetime.fromisoformat(sn.get("publishedAt", now.isoformat()).replace("Z", "+00:00"))
    hours = max((now - pub).total_seconds() / 3600, 1.0)
    views = int(st.get("viewCount", 0))
    return {
        "video_id": item["id"] if isinstance(item["id"], str) else item["id"].get("videoId"),
        "title": sn.get("title", ""),
        "channel": sn.get("channelTitle", ""),
        "published_at": pub.isoformat(),
        "view_count": views,
        "like_count": int(st.get("likeCount", 0)),
        "comment_count": int(st.get("commentCount", 0)),
        "duration_sec": parse_duration(item.get("contentDetails", {}).get("duration", "")),
        "tags": sn.get("tags", [])[:20],
        "description": (sn.get("description") or "")[:500],
        "category_id": sn.get("categoryId"),
        "views_per_hour": round(views / hours, 1),
    }


def filter_videos(videos: list[dict], cfg, now: datetime, exclude_ids: set[str]) -> list[dict]:
    cutoff = now - timedelta(hours=cfg.published_within_hours)
    seen: set[str] = set()
    out = []
    for v in videos:
        vid = v["video_id"]
        if vid in seen or vid in exclude_ids:
            continue
        seen.add(vid)
        if v["view_count"] < cfg.min_view_count:
            continue
        if datetime.fromisoformat(v["published_at"]) < cutoff:
            continue
        if not cfg.include_shorts and 0 < v["duration_sec"] <= 60:
            continue
        hay = " ".join([v["title"], v["description"], *v["tags"]]).lower()
        if any(k.lower() in hay for k in cfg.exclude_keywords):
            continue
        out.append(v)
    out.sort(key=lambda v: v["views_per_hour"], reverse=True)
    return out[: cfg.max_videos]


def recently_processed_ids(session, days: int, today: str) -> set[str]:
    """지난 N일 동안 다른 run 에서 이미 주제로 묶인(=처리된) 영상."""
    # today 는 'YYYY-MM-DD' 또는 같은 날 추가 실행 'YYYY-MM-DD-N' → 같은 날 앞선 실행에서 쓴 영상도 제외됨
    since = (datetime.strptime(today[:10], "%Y-%m-%d") - timedelta(days=days)).strftime("%Y-%m-%d")
    q = (select(topic_videos.c.video_id).join(Topic, Topic.id == topic_videos.c.topic_id)
         .join(Run, Run.id == Topic.run_id).where(Run.date >= since, Run.date < today))
    return set(session.scalars(q))


# ---------------------------------------------------------------- 엔트리
def collect(ctx, client: YouTubeClient | None = None, now: datetime | None = None) -> list[dict]:
    cfg = ctx.settings.collect
    now = now or datetime.now(timezone.utc)
    quota = QuotaManager(cfg.daily_quota, cfg.quota_stop_ratio, used=ctx.run.quota_used or 0)
    yt = client or YouTubeClient(env("YOUTUBE_API_KEY"), quota)
    yt.quota = quota

    raw: list[dict] = []
    try:
        # 1순위: mostPopular 차트 (1유닛)
        for cat in (cfg.category_ids or [None]):
            try:
                raw += yt.most_popular(cfg.region_code, cat)
            except httpx.HTTPStatusError as e:  # 지역에 인기 차트가 없는 카테고리 등
                log.warning("인기 차트(카테고리 %s) 조회 실패: %s", cat, e.response.status_code)
        # 보조: search.list (100유닛) → videos.list 로 상세 조회
        after = now - timedelta(hours=cfg.published_within_hours)
        ids: list[str] = []
        for cat in ((cfg.category_ids if cfg.search_with_categories else []) or [None]):
            for q in (cfg.search_queries or [None]):
                ids += yt.search_ids(after, cfg.region_code, cfg.relevance_language, q, cat,
                                     safe_search=cfg.safe_search)
        known = {it["id"] for it in raw if isinstance(it.get("id"), str)}
        raw += yt.videos([i for i in ids if i not in known])
    except QuotaExceeded as e:
        log.warning("%s — 지금까지 수집한 결과로 진행", e)
    finally:
        ctx.tracker.add("youtube_quota_units", quota.used - (ctx.run.quota_used or 0), cost_usd=0)
        ctx.run.quota_used = quota.used

    normalized = [normalize(it, now) for it in raw]
    exclude = recently_processed_ids(ctx.session, cfg.dedupe_days, ctx.run_date)
    videos = filter_videos(normalized, cfg, now, exclude)
    log.info("수집: 원본 %d개 → 필터 후 %d개 (쿼터 %d)", len(normalized), len(videos), quota.used)

    for v in videos:
        row = ctx.session.get(Video, v["video_id"]) or Video(video_id=v["video_id"])
        row.title, row.channel = v["title"], v["channel"]
        row.published_at = datetime.fromisoformat(v["published_at"])
        row.view_count, row.like_count, row.comment_count = v["view_count"], v["like_count"], v["comment_count"]
        row.duration_sec, row.views_per_hour = v["duration_sec"], v["views_per_hour"]
        row.tags, row.description, row.run_date = v["tags"], v["description"], ctx.run_date
        ctx.session.merge(row)
    ctx.write_json("videos.json", videos)
    ctx.set_status("collected")
    return videos
