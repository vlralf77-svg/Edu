"""Step 3. 웹 조사. provider: claude(web search 서버 툴) | tavily | serper."""
from __future__ import annotations

import logging
from typing import Any
from urllib.parse import urlparse

import httpx
from sqlalchemy import select
from tenacity import retry, stop_after_attempt, wait_exponential

from ..config import env, load_prompt
from ..models import Topic

log = logging.getLogger(__name__)

RESEARCH_SCHEMA = {
    "type": "object",
    "properties": {
        "sources": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "url": {"type": "string"},
                    "title": {"type": "string"},
                    "publisher": {"type": "string"},
                    "published_date": {"type": "string"},
                    "facts": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["url", "title", "publisher", "published_date", "facts"],
                "additionalProperties": False,
            },
        },
        "key_facts": {"type": "array", "items": {"type": "string"}},
        "contradictions": {"type": "array", "items": {"type": "string"}},
        "confidence": {"type": "string", "enum": ["high", "medium", "low"]},
    },
    "required": ["sources", "key_facts", "contradictions", "confidence"],
    "additionalProperties": False,
}

BLOCKED_HOSTS = ("youtube.com", "youtu.be", "tiktok.com", "instagram.com")


def _searched_urls(content: list[Any]) -> set[str]:
    """web_search_tool_result 블록에 실제로 등장한 URL 집합 (모델이 지어낸 URL 걸러내기용)."""
    urls: set[str] = set()
    for b in content:
        if getattr(b, "type", "") == "web_search_tool_result" and isinstance(getattr(b, "content", None), list):
            for r in b.content:
                if getattr(r, "url", None):
                    urls.add(r.url)
    return urls


def finalize(data: dict, min_sources: int, allowed_urls: set[str] | None = None) -> dict:
    sources = []
    seen = set()
    for src in data.get("sources", []):
        url = src.get("url", "")
        host = urlparse(url).netloc.lower()
        if not url.startswith("http") or url in seen or any(h in host for h in BLOCKED_HOSTS):
            continue
        if allowed_urls is not None and url not in allowed_urls:
            log.debug("검색 결과에 없는 URL 제거: %s", url)
            continue
        seen.add(url)
        sources.append(src)
    data["sources"] = sources
    distinct_hosts = {urlparse(s["url"]).netloc for s in sources}
    if len(distinct_hosts) < min_sources or data.get("contradictions"):
        data["confidence"] = "low"
    data.setdefault("confidence", "medium")
    return data


class _HTTPSearch:
    def search(self, query: str) -> list[dict]:  # -> [{url,title,snippet,date}]
        raise NotImplementedError


class TavilySearch(_HTTPSearch):
    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10), reraise=True)
    def search(self, query: str) -> list[dict]:
        r = httpx.post("https://api.tavily.com/search", timeout=30, json={
            "api_key": env("TAVILY_API_KEY"), "query": query, "topic": "news", "max_results": 6, "days": 3})
        r.raise_for_status()
        return [{"url": x["url"], "title": x.get("title", ""), "snippet": x.get("content", "")[:500],
                 "date": x.get("published_date", "")} for x in r.json().get("results", [])]


class SerperSearch(_HTTPSearch):
    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10), reraise=True)
    def search(self, query: str) -> list[dict]:
        r = httpx.post("https://google.serper.dev/news", timeout=30, headers={"X-API-KEY": env("SERPER_API_KEY")},
                       json={"q": query, "gl": "kr", "hl": "ko", "num": 8})
        r.raise_for_status()
        return [{"url": x["link"], "title": x.get("title", ""), "snippet": x.get("snippet", ""),
                 "date": x.get("date", "")} for x in r.json().get("news", [])]


def research_topic(ctx, topic: dict, searcher: _HTTPSearch | None = None) -> dict:
    s = ctx.settings
    titles = "\n".join(f"- {v.title}" for v in topic.get("_videos", [])) or "-"
    if s.research.provider in ("llm", "claude"):  # 선택한 LLM 의 내장 웹 검색 (Claude web search / Gemini Google 검색)
        prompt = load_prompt("research", topic=topic["title"], summary=topic["summary"],
                             searches=s.research.searches_per_topic, video_titles=titles)
        tool = ctx.llm.web_search_tool(max_uses=s.research.searches_per_topic + 1)
        data, res = ctx.llm.complete_json(prompt, tools=[tool])
        return finalize(data, s.research.min_sources, _searched_urls(res.content) or None)

    searcher = searcher or (TavilySearch() if s.research.provider == "tavily" else SerperSearch())
    queries = [topic["title"], f"{topic['title']} 공식 발표", f"{topic['title']} 뉴스"]
    queries += [f"{topic['title']} {a}" for a in topic.get("angle_ideas", [])]
    results: list[dict] = []
    for q in queries[: s.research.searches_per_topic]:
        results += searcher.search(q)
        ctx.tracker.add(f"search_calls:{s.research.provider}", 1)
    urls = {r["url"] for r in results}
    lines = "\n".join(f"- [{r['date']}] {r['title']} ({r['url']}): {r['snippet']}" for r in results)
    prompt = load_prompt("research_summarize", topic=topic["title"], summary=topic["summary"], results=lines)
    data, _ = ctx.llm.complete_json(prompt, schema=RESEARCH_SCHEMA)
    return finalize(data, s.research.min_sources, urls)


def research(ctx, limit: int | None = None) -> dict[str, dict]:
    s = ctx.settings
    limit = limit or s.topics.max_topics_per_day
    rows = list(ctx.session.scalars(select(Topic).where(Topic.run_id == ctx.run.id).order_by(Topic.score.desc())))
    out: dict[str, dict] = {}
    for row in rows[:limit]:
        if row.research and row.status not in ("clustered", "failed"):
            out[row.key] = row.research
            continue
        topic = {"title": row.title, "summary": row.summary, "angle_ideas": row.angle_ideas, "_videos": row.videos}
        try:
            data = research_topic(ctx, topic)
        except Exception as e:  # 한 주제 실패가 전체를 멈추지 않게
            from ..costs import BudgetExceeded
            if isinstance(e, BudgetExceeded):
                raise
            log.exception("조사 실패: %s", row.title)
            row.status = "failed"
            continue
        data["topic_id"] = row.key
        row.research, row.confidence, row.status = data, data["confidence"], "researched"
        ctx.write_json(f"research/{row.key}.json", data)
        ctx.save()
        out[row.key] = data
        log.info("조사 완료: %s (출처 %d, 신뢰도 %s)", row.title, len(data["sources"]), data["confidence"])
    ctx.set_status("researched")
    return out
