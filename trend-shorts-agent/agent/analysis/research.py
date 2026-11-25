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
    # 구글 뉴스 링크는 모두 news.google.com 이라 언론사 이름으로 출처 개수를 센다
    distinct_hosts = {(s.get("publisher") or urlparse(s["url"]).netloc) if "news.google.com" in s["url"]
                      else urlparse(s["url"]).netloc for s in sources}
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


class NewsRSSSearch(_HTTPSearch):
    """구글 뉴스 RSS (무료, 키 불필요). 최근 며칠 한국어 기사 제목·언론사·요약."""

    def __init__(self, days: int = 3, http: httpx.Client | None = None):
        self.days = days
        self.http = http or httpx.Client(timeout=20, follow_redirects=True,
                                         headers={"User-Agent": "Mozilla/5.0 trend-shorts-agent"})

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10), reraise=True)
    def search(self, query: str) -> list[dict]:
        import html as _html
        import re as _re
        import xml.etree.ElementTree as ET
        r = self.http.get("https://news.google.com/rss/search",
                          params={"q": f"{query} when:{self.days}d", "hl": "ko", "gl": "KR", "ceid": "KR:ko"})
        r.raise_for_status()
        out = []
        for item in ET.fromstring(r.content).iter("item"):
            src = item.find("source")
            desc = _html.unescape(_re.sub(r"<[^>]+>", " ", item.findtext("description", "")))
            out.append({"url": item.findtext("link", ""), "title": item.findtext("title", ""),
                        "snippet": " ".join(desc.split())[:300], "date": item.findtext("pubDate", ""),
                        "publisher": src.text if src is not None else "",
                        "publisher_url": src.get("url", "") if src is not None else ""})
        return out[:8]


def resolve_provider(settings) -> str:
    p = settings.research.provider
    if p == "auto":  # Gemini 무료 등급은 구글 검색 한도가 매우 작아 뉴스 RSS 사용
        return "llm" if settings.llm.provider == "claude" else "news"
    return p


def research_topic(ctx, topic: dict, searcher: _HTTPSearch | None = None) -> dict:
    s = ctx.settings
    titles = "\n".join(f"- {v.title}" for v in topic.get("_videos", [])) or "-"
    provider = resolve_provider(s)
    if provider in ("llm", "claude"):  # 선택한 LLM 의 내장 웹 검색 (Claude web search / Gemini Google 검색)
        prompt = load_prompt("research", topic=topic["title"], summary=topic["summary"],
                             searches=s.research.searches_per_topic, video_titles=titles)
        tool = ctx.llm.web_search_tool(max_uses=s.research.searches_per_topic + 1)
        try:
            data, res = ctx.llm.complete_json(prompt, tools=[tool])
            return finalize(data, s.research.min_sources, _searched_urls(res.content) or None)
        except Exception as e:  # noqa: BLE001
            from ..costs import BudgetExceeded
            if isinstance(e, BudgetExceeded) or s.llm.provider == "claude":
                raise
            log.warning("Gemini 구글 검색 실패(%s) → 구글 뉴스 RSS 로 조사", str(e)[:120])
            provider = "news"

    if searcher is None:
        searcher = {"tavily": TavilySearch, "serper": SerperSearch}.get(provider, NewsRSSSearch)()
    queries = [topic["title"]] + [f"{topic['title']} {a}" for a in topic.get("angle_ideas", [])]
    if provider in ("tavily", "serper"):
        queries.insert(1, f"{topic['title']} 공식 발표")
    results: list[dict] = []
    seen: set[str] = set()
    for q in queries[: s.research.searches_per_topic]:
        for r in searcher.search(q):
            if r["url"] not in seen:
                seen.add(r["url"])
                results.append(r)
        ctx.tracker.add(f"search_calls:{provider}", 1)
    results = results[:15]
    if not results:
        return finalize({"sources": [], "key_facts": [], "contradictions": [], "confidence": "low"},
                        s.research.min_sources, set())
    urls = {r["url"] for r in results}
    lines = "\n".join(f"- [{r['date']}] {r.get('publisher', '')} | {r['title']} ({r['url']}): {r['snippet']}"
                      for r in results)
    prompt = load_prompt("research_summarize", topic=topic["title"], summary=topic["summary"], results=lines)
    data, _ = ctx.llm.complete_json(prompt, schema=RESEARCH_SCHEMA)
    return finalize(data, s.research.min_sources, urls)


def research(ctx, limit: int | None = None) -> dict[str, dict]:
    s = ctx.settings
    limit = limit or s.topics.max_topics_per_day
    rows = list(ctx.session.scalars(select(Topic).where(Topic.run_id == ctx.run.id).order_by(Topic.score.desc())))
    out: dict[str, dict] = {}
    for row in rows[:limit]:
        if row.research and row.status != "clustered":  # 조사 끝난 주제(뒤 단계에서 실패했어도)는 다시 조사 안 함
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
