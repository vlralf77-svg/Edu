"""📰 기사 링크로 만들기."""
import json

import httpx
import pytest

from agent.analysis.article import ArticleError, extract, fetch_article
from agent.context import RunContext, today
from agent.llm import LLMResult
from agent.models import Script, Topic
from agent.pipeline import run_from_urls

from .conftest import FakeLLM

ARTICLE_HTML = """<html><head>
<meta property="og:title" content="손흥민, 시즌 10호골…팀 3연승 이끌어 - 연합뉴스">
<meta property="og:site_name" content="연합뉴스">
<meta property="og:description" content="손흥민이 리그 경기에서 결승골을 넣었다.">
<meta property="article:published_time" content="2026-11-26T21:00:00+09:00">
<title>무시되는 제목</title><script>var x = "스크립트 내용은 제외되어야 합니다 아주 긴 문장입니다 정말로";</script>
</head><body>
<nav>메뉴 메뉴 메뉴 메뉴 메뉴 메뉴 메뉴 메뉴 메뉴 메뉴 메뉴 메뉴 메뉴 메뉴</nav>
<div id="articleBody" class="article_txt">
<p>손흥민은 26일(현지시간) 열린 리그 경기에서 후반 23분 결승골을 터뜨렸다.</p>
<p>이 골로 손흥민은 이번 시즌 리그 10호골을 기록했고, 팀은 3연승을 달렸다.</p>
<p>감독은 경기 후 인터뷰에서 손흥민의 경기력을 높이 평가했다고 밝혔다.</p>
<p>홍길동 기자 hong@yna.co.kr</p><p>저작권자(c) 연합뉴스, 무단 전재-재배포 금지</p>
</div>
<div class="related">관련 기사 관련 기사 관련 기사 관련 기사 관련 기사 관련 기사</div>
</body></html>"""


def test_extract_article():
    a = extract(ARTICLE_HTML, "https://www.yna.co.kr/view/AKR1")
    assert a["title"] == "손흥민, 시즌 10호골…팀 3연승 이끌어"
    assert a["publisher"] == "연합뉴스" and a["published"] == "2026-11-26"
    assert "후반 23분 결승골" in a["text"] and "10호골" in a["text"]
    assert "스크립트" not in a["text"] and "메뉴" not in a["text"] and "무단" not in a["text"] and "@" not in a["text"]


def test_fetch_article_errors():
    with pytest.raises(ArticleError, match="영상"):
        fetch_article("https://www.youtube.com/shorts/abc")
    with pytest.raises(ArticleError, match="올바르지"):
        fetch_article("not a url")
    http = httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(200, text="<html><body>짧음</body></html>")))
    with pytest.raises(ArticleError, match="본문을 찾지"):
        fetch_article("https://news.example.com/x", http=http)
    http = httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(403)))
    with pytest.raises(ArticleError, match="403"):
        fetch_article("https://news.example.com/x", http=http)


class ArticleLLM(FakeLLM):
    """조사 요약은 기사·관련기사 URL 로 답하고, 나머지는 FakeLLM 그대로."""

    def complete_json(self, prompt, **kw):
        if "[검색 결과]" in prompt:
            self.calls.append("summarize")
            urls = [u for u in ("https://www.yna.co.kr/view/AKR1", "https://news.google.com/rss/articles/B")
                    if u in prompt]
            data = {"sources": [{"url": u, "title": "t", "publisher": p, "published_date": "", "facts": ["f"]}
                                for u, p in zip(urls, ["연합뉴스", "한겨레"])],
                    "key_facts": ["후반 23분 결승골", "시즌 10호골"], "contradictions": [], "confidence": "high"}
            return data, LLMResult(text=json.dumps(data))
        return super().complete_json(prompt, **kw)


class FakeNews:
    def search(self, q):
        return [{"url": "https://news.google.com/rss/articles/B", "title": "관련", "snippet": "s", "date": "",
                 "publisher": "한겨레"}]


def test_run_from_urls_end_to_end(settings, monkeypatch):
    llm = ArticleLLM()
    monkeypatch.setattr("agent.context.RunContext.llm", llm)
    art = extract(ARTICLE_HTML, "https://www.yna.co.kr/view/AKR1")
    fetched = []

    def fetch(url):
        fetched.append(url)
        if "bad" in url:
            raise ArticleError("기사를 불러오지 못했습니다 (403): " + url)
        return art
    name = run_from_urls(["https://www.yna.co.kr/view/AKR1", "https://bad.example.com/x", ""], profile="soccer",
                         settings=settings, fetch=fetch, searcher=FakeNews())
    assert name == f"{today(settings)}-soccer-url"
    with RunContext(name, settings) as ctx:
        topics = ctx.session.query(Topic).all()
        assert len(topics) == 1 and topics[0].title.startswith("손흥민")
        assert topics[0].research["origin_article"] == "https://www.yna.co.kr/view/AKR1"
        assert topics[0].confidence == "high"                        # 언론사 2곳 교차 확인
        s = ctx.session.query(Script).filter_by(approval_status="pending_review").one()
        assert "https://www.yna.co.kr/view/AKR1" in s.json["sources"]
        assert ctx.settings.profile == "soccer"
    summary = (settings.run_dir(name) / "summary.txt").read_text(encoding="utf-8")
    assert "기사 2개" in summary and "검토 후보 1개" in summary and "처리 못 한 기사" in summary
    assert next(c for c in llm.calls if c == "summarize")
    # 같은 날 다시 하면 새 실행 이름
    assert run_from_urls(["https://www.yna.co.kr/view/AKR1"], profile="soccer", settings=settings, fetch=fetch,
                         searcher=FakeNews()) == f"{today(settings)}-soccer-url-2"


def test_run_from_urls_all_fail(settings, monkeypatch):
    monkeypatch.setattr("agent.context.RunContext.llm", ArticleLLM())

    def fetch(url):
        raise ArticleError("유료 기사")
    with pytest.raises(RuntimeError, match="하나도 처리하지 못했습니다"):
        run_from_urls(["https://x.example.com/a"], settings=settings, fetch=fetch, searcher=FakeNews())
