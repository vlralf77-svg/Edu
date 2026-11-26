"""Step 2. 주제 클러스터링 + 점수화."""
from __future__ import annotations

import logging
import math
import re

from sqlalchemy import select

from ..config import load_prompt
from ..models import Topic, Video

log = logging.getLogger(__name__)

CLUSTER_SCHEMA = {
    "type": "object",
    "properties": {
        "topics": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "topic_id": {"type": "string"},
                    "title": {"type": "string"},
                    "summary": {"type": "string"},
                    "related_video_ids": {"type": "array", "items": {"type": "string"}},
                    "fitness": {"type": "integer"},
                    "angle_ideas": {"type": "array", "items": {"type": "string"}},
                    "excluded": {"type": "boolean"},
                    "exclude_reason": {"type": "string"},
                },
                "required": ["topic_id", "title", "summary", "related_video_ids", "fitness", "angle_ideas",
                             "excluded", "exclude_reason"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["topics"],
    "additionalProperties": False,
}


def _video_line(v: dict) -> str:
    tags = ",".join(v.get("tags", [])[:8])
    desc = (v.get("description") or "").replace("\n", " ")[:150]
    return f"{v['video_id']} | {v['title']} | {v['channel']} | {v['view_count']:,} | {v['views_per_hour']:,.0f} | {tags} | {desc}"


def _slug(s: str, fallback: str) -> str:
    s = re.sub(r"[^a-z0-9-]+", "-", s.lower()).strip("-")[:48]
    return s or fallback


def parse_clusters(data: dict, videos: list[dict], min_videos: int) -> tuple[list[dict], list[dict]]:
    """LLM 출력 검증: 존재하지 않는 영상 id 제거, 중복 배정 제거, 적합도 범위 보정."""
    by_id = {v["video_id"]: v for v in videos}
    by_title = {v.get("title", "").strip(): v["video_id"] for v in videos if v.get("title")}
    used: set[str] = set()
    kept, excluded = [], []
    seen_ids: set[str] = set()

    def resolve(x) -> str | None:
        """LLM 이 id 를 조금 다르게 돌려줘도 찾기: 공백·URL·제목·목록 번호."""
        x = str(x).strip().strip('"\'')
        if x in by_id:
            return x
        for vid in by_id:  # https://youtu.be/ID, watch?v=ID, "ID | 제목" 등
            if len(vid) >= 6 and vid in x:
                return vid
        if x in by_title:
            return by_title[x]
        if x.isdigit() and 1 <= int(x) <= len(videos):  # 1부터 센 목록 번호
            return videos[int(x) - 1]["video_id"]
        return None

    for i, t in enumerate(data.get("topics", [])):
        vids = []
        for x in t.get("related_video_ids", []):
            vid = resolve(x)
            if vid and vid not in used and vid not in vids:
                vids.append(vid)
        tid = _slug(t.get("topic_id", ""), f"topic-{i + 1}")
        while tid in seen_ids:
            tid += "-x"
        seen_ids.add(tid)
        topic = {
            "topic_id": tid,
            "title": t.get("title", "").strip(),
            "summary": t.get("summary", "").strip(),
            "related_video_ids": vids,
            "fitness": max(1, min(5, int(t.get("fitness", 3)))),
            "angle_ideas": list(t.get("angle_ideas", []))[:3],
        }
        if t.get("excluded"):
            topic["exclude_reason"] = t.get("exclude_reason", "")
            excluded.append(topic)
            continue
        if len(vids) < min_videos:
            continue
        used.update(vids)
        kept.append(topic)
    return kept, excluded


def score_topics(topics: list[dict], videos: list[dict], weights: dict[str, float]) -> list[dict]:
    """합산 조회수·평균 views/hour·영상 수·적합도의 가중합 (각 항목은 log 스케일 후 최대값으로 정규화)."""
    by_id = {v["video_id"]: v for v in videos}
    feats = []
    for t in topics:
        vs = [by_id[x] for x in t["related_video_ids"]]
        feats.append({
            "total_views": math.log1p(sum(v["view_count"] for v in vs)),
            "views_per_hour": math.log1p(sum(v["views_per_hour"] for v in vs) / max(len(vs), 1)),
            "video_count": float(len(vs)),
            "fitness": t["fitness"] / 5,
        })
    maxima = {k: max((f[k] for f in feats), default=1) or 1 for k in weights}
    for t, f in zip(topics, feats):
        t["score"] = round(100 * sum(w * f[k] / maxima[k] for k, w in weights.items()), 2)
        vs = [by_id[x] for x in t["related_video_ids"]]
        t["total_views"] = sum(v["view_count"] for v in vs)
    topics.sort(key=lambda t: t["score"], reverse=True)
    return topics


def cluster(ctx, videos: list[dict] | None = None) -> list[dict]:
    s = ctx.settings
    videos = videos if videos is not None else ctx.read_json("videos.json")
    if not videos:
        log.warning("클러스터링할 영상이 없습니다")
        ctx.write_json("topics.json", [])
        ctx.set_status("clustered")
        return []
    prompt = load_prompt("cluster_topics" if s.profile == "general" else f"cluster_topics_{s.profile}", hours=s.collect.published_within_hours,
                         videos="\n".join(_video_line(v) for v in videos))
    data, _ = ctx.llm.complete_json(prompt, schema=CLUSTER_SCHEMA)
    topics, excluded = parse_clusters(data, videos, s.topics.min_videos_per_topic)
    topics = score_topics(topics, videos, s.topics.weights)
    log.info("클러스터: %d개 주제 (제외 %d개)", len(topics), len(excluded))

    # DB 반영 (같은 run 재실행 시 key 기준 upsert)
    existing = {t.key: t for t in ctx.session.scalars(select(Topic).where(Topic.run_id == ctx.run.id))}
    for t in topics:
        row = existing.get(t["topic_id"]) or Topic(run_id=ctx.run.id, key=t["topic_id"])
        row.title, row.summary, row.score = t["title"], t["summary"], t["score"]
        row.fitness, row.angle_ideas, row.status = t["fitness"], t["angle_ideas"], "clustered"
        row.videos = [v for v in (ctx.session.get(Video, x) for x in t["related_video_ids"]) if v]
        ctx.session.add(row)
    ctx.write_json("topics.json", topics)
    ctx.write_json("topics_excluded.json", excluded)
    ctx.set_status("clustered")
    return topics
