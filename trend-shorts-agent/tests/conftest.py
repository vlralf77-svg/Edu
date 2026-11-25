"""공용 픽스처: 임시 data 디렉터리 설정 + 외부 API 를 대신하는 가짜 LLM / YouTube."""
from __future__ import annotations

import json
import re
from datetime import datetime, timedelta, timezone

import httpx
import pytest

from agent.config import load_settings
from agent.llm import LLMResult

NOW = datetime(2026, 11, 25, 0, 0, tzinfo=timezone.utc)


@pytest.fixture
def settings(tmp_path):
    return load_settings(overrides={"paths": {"data_dir": str(tmp_path / "data")},
                                    "notify": {"enabled": False}})


class WebResult:  # web_search_tool_result 블록 흉내
    def __init__(self, urls):
        self.type = "web_search_tool_result"
        self.content = [type("R", (), {"url": u})() for u in urls]


def make_scenes(total_chars: int, n: int = 5) -> list[dict]:
    per = total_chars // n
    base = "가나다라마바사아자차카타파하" * 40
    return [{"idx": i + 1, "narration": base[i:i + per], "on_screen_text": f"장면{i + 1}",
             "visual_query": "city night", "seconds": 5} for i in range(n)]


class FakeLLM:
    """프롬프트 내용으로 단계를 구분해 정해진 JSON 을 돌려준다. calls 로 호출 기록 확인."""

    def __init__(self, script_lengths=(300,), fact_flags=None):
        self.calls: list[str] = []
        self.script_lengths = list(script_lengths)
        self.fact_flags = fact_flags or []

    @staticmethod
    def web_search_tool(max_uses=5):
        return {"type": "web_search_20260209", "name": "web_search", "max_uses": max_uses}

    def complete_json(self, prompt, schema=None, tools=None, system=None, max_tokens=None):
        if "같은 이슈" in prompt:
            self.calls.append("cluster")
            ids = re.findall(r"^(v\d+) \|", prompt, re.M)
            data = {"topics": [
                {"topic_id": "AI Phone!", "title": "AI 폰 공개", "summary": "제조사들이 AI 폰 공개",
                 "related_video_ids": ids[:2] + ["nope"], "fitness": 5, "angle_ideas": ["배터리", "보안"],
                 "excluded": False, "exclude_reason": ""},
                {"topic_id": "rumor", "title": "연예인 사생활", "summary": "루머", "related_video_ids": ids[2:3],
                 "fitness": 4, "angle_ideas": [], "excluded": True, "exclude_reason": "사생활"},
                {"topic_id": "baseball", "title": "야구 우승", "summary": "우승", "related_video_ids": ids[3:4],
                 "fitness": 9, "angle_ideas": ["기록"], "excluded": False, "exclude_reason": ""},
            ]}
            return data, LLMResult(text=json.dumps(data))
        if "팩트 조사원" in prompt:
            self.calls.append("research")
            urls = ["https://news.example.com/a", "https://gov.example.kr/b"]
            data = {"sources": [
                {"url": urls[0], "title": "기사", "publisher": "뉴스", "published_date": "2026-11-24", "facts": ["A"]},
                {"url": urls[1], "title": "발표", "publisher": "기관", "published_date": "2026-11-24", "facts": ["B"]},
                {"url": "https://made-up.example/x", "title": "?", "publisher": "", "published_date": "", "facts": []},
                {"url": "https://www.youtube.com/watch?v=1", "title": "영상", "publisher": "", "published_date": "",
                 "facts": []}],
                "key_facts": ["A", "B"], "contradictions": [], "confidence": "high"}
            return data, LLMResult(text="", content=[WebResult(urls + ["https://www.youtube.com/watch?v=1"])])
        if "숏폼 뉴스 브리핑 작가" in prompt:
            self.calls.append("write")
            n = self.script_lengths.pop(0) if len(self.script_lengths) > 1 else self.script_lengths[0]
            data = {"title": "AI 폰, 진짜 달라질까? 제목이 아주 아주 길어서 사십 자를 넘어가는 경우를 테스트합니다",
                    "hashtags": ["AI", "#폰", "#AI"], "estimated_seconds": 50, "scenes": make_scenes(n),
                    "sources": ["https://news.example.com/a", "https://invented.example/z"], "risk_notes": ""}
            return data, LLMResult(text=json.dumps(data))
        if "팩트체커" in prompt:
            self.calls.append("fact")
            data = {"scenes": [], "removed_sentences": [], "flags": self.fact_flags, "notes": "ok"}
            return data, LLMResult(text=json.dumps(data))
        if "배경음악 분위기" in prompt:
            self.calls.append("mood")
            data = {"mood": "tech", "energy": 0.7, "tempo_bpm": 200, "key": "A minor", "reason": "IT"}
            return data, LLMResult(text=json.dumps(data))
        raise AssertionError("unexpected prompt: " + prompt[:80])


def yt_item(i: int, views: int, hours_ago: float, duration="PT5M", title=None, tags=None):
    return {"id": f"v{i}", "snippet": {
        "title": title or f"영상 {i}", "channelTitle": f"채널{i}", "description": "설명 " * 10,
        "publishedAt": (NOW - timedelta(hours=hours_ago)).strftime("%Y-%m-%dT%H:%M:%SZ"), "tags": tags or ["태그"],
        "categoryId": "25"}, "statistics": {"viewCount": str(views), "likeCount": "10", "commentCount": "3"},
        "contentDetails": {"duration": duration}}


DEFAULT_ITEMS = [
    yt_item(1, 500_000, 10), yt_item(2, 300_000, 5), yt_item(3, 200_000, 20), yt_item(4, 150_000, 30),
    yt_item(5, 50_000, 3),                                  # 조회수 미달
    yt_item(6, 900_000, 100),                               # 48시간 초과
    yt_item(7, 400_000, 8, title="도박 사이트 후기"),         # 제외 키워드
]


@pytest.fixture
def yt_transport():
    """YouTube Data API mock. 호출 기록은 transport.calls."""
    calls = []

    def handler(req: httpx.Request):
        calls.append((req.url.path, dict(req.url.params)))
        params = req.url.params
        if req.url.path.endswith("/videos") and params.get("chart") == "mostPopular":
            return httpx.Response(200, json={"items": DEFAULT_ITEMS[:5]})
        if req.url.path.endswith("/search"):
            return httpx.Response(200, json={"items": [{"id": {"videoId": f"v{i}"}} for i in (1, 6, 7)]})
        if req.url.path.endswith("/videos"):
            ids = params["id"].split(",")
            return httpx.Response(200, json={"items": [it for it in DEFAULT_ITEMS if it["id"] in ids]})
        return httpx.Response(404)

    t = httpx.MockTransport(handler)
    t.calls = calls
    return t
