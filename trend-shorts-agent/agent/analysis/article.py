"""뉴스 기사 주소 → 제목·언론사·날짜·본문 추출 (추가 설치 없이 표준 라이브러리 HTML 파서 사용).

기사 본문은 사실을 뽑는 재료로만 쓰고, 대본은 새로 쓴다 (문장을 그대로 옮기지 않음). 원문 링크는 출처로 남긴다.
"""
from __future__ import annotations

import html as _html
import re
from html.parser import HTMLParser
from urllib.parse import urlparse

import httpx

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
      "Chrome/124.0 Safari/537.36")
BLOCK = {"p", "div", "br", "li", "h1", "h2", "h3", "h4", "section", "article", "tr", "td", "figcaption"}
SKIP = {"script", "style", "noscript", "iframe", "svg", "nav", "footer", "header", "form", "button", "aside"}
JUNK = re.compile(r"(무단\s*전재|재배포\s*금지|저작권자|Copyright|ⓒ|©|구독하기|기자\s*[\w.]+@|@[\w-]+\.(com|co\.kr|kr)|"
                  r"관련\s*기사|많이\s*본\s*뉴스|댓글|좋아요|공유하기|광고)", re.I)
BODY_HINT = re.compile(r"(article|news[_-]?body|newsct|art_txt|article[_-]?body|dic_area|content[_-]?body|"
                       r"story|view[_-]?con|news[_-]?view|articletxt)", re.I)


class ArticleError(RuntimeError):
    pass


class _Parser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.meta: dict[str, str] = {}
        self.title = ""
        self._in_title = False
        self._skip = 0
        self.blocks: list[tuple[bool, str]] = []   # (본문 영역 안인지, 텍스트)
        self._buf: list[str] = []
        self._body_depth: list[int] = []
        self._depth = 0

    def _flush(self):
        t = " ".join("".join(self._buf).split())
        if t:
            self.blocks.append((bool(self._body_depth), t))
        self._buf = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "meta":
            k = (a.get("property") or a.get("name") or "").lower()
            if k and a.get("content"):
                self.meta.setdefault(k, a["content"])
            return
        if tag in ("br", "img", "hr", "input", "link"):
            if tag == "br":
                self._flush()
            return
        self._depth += 1
        if tag == "title":
            self._in_title = True
        if tag in SKIP:
            self._skip += 1
        if tag in BLOCK:
            self._flush()
        if tag in ("article", "div", "section") and (tag == "article" or BODY_HINT.search(
                f"{a.get('id', '')} {a.get('class', '')} {a.get('itemprop', '')}")):
            self._body_depth.append(self._depth)

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False
        if tag in SKIP and self._skip:
            self._skip -= 1
        if tag in BLOCK:
            self._flush()
        if self._body_depth and self._body_depth[-1] == self._depth:
            self._flush()
            self._body_depth.pop()
        self._depth = max(self._depth - 1, 0)

    def handle_data(self, data):
        if self._in_title:
            self.title += data
            return
        if not self._skip:
            self._buf.append(data)


def extract(html_text: str, url: str = "") -> dict:
    p = _Parser()
    p.feed(html_text)
    p._flush()
    m = p.meta
    title = (m.get("og:title") or m.get("twitter:title") or p.title or "").strip()
    title = re.sub(r"\s*[-|:]\s*[^-|:]{1,20}$", "", title) if len(title) > 25 else title  # " - 언론사" 꼬리 제거
    body_blocks = [t for inside, t in p.blocks if inside]
    blocks = body_blocks if sum(len(t) for t in body_blocks) > 300 else [t for _, t in p.blocks]
    lines, seen = [], set()
    for t in blocks:
        if len(t) < 30 or JUNK.search(t) or t in seen:
            continue
        seen.add(t)
        lines.append(t)
    text = "\n".join(lines)[:6000]
    return {
        "url": url,
        "title": _html.unescape(title),
        "description": _html.unescape(m.get("og:description") or m.get("description") or ""),
        "publisher": m.get("og:site_name") or urlparse(url).netloc.removeprefix("www."),
        "published": (m.get("article:published_time") or m.get("og:article:published_time")
                      or m.get("pubdate") or m.get("date") or "")[:10],
        "text": text,
    }


def fetch_article(url: str, http: httpx.Client | None = None) -> dict:
    url = url.strip()
    if not re.match(r"^https?://", url):
        raise ArticleError(f"기사 주소가 올바르지 않습니다: {url}")
    if any(h in urlparse(url).netloc for h in ("youtube.com", "youtu.be", "tiktok.com", "instagram.com")):
        raise ArticleError("영상·SNS 주소는 쓸 수 없습니다. 뉴스 기사 주소를 넣어 주세요.")
    client = http or httpx.Client(timeout=20, follow_redirects=True, headers={"User-Agent": UA})
    try:
        r = client.get(url)
        r.raise_for_status()
    except httpx.HTTPStatusError as e:
        raise ArticleError(f"기사를 불러오지 못했습니다 ({e.response.status_code}): {url}") from e
    except httpx.HTTPError as e:
        raise ArticleError(f"기사 사이트에 연결하지 못했습니다: {url} ({e})") from e
    if not r.encoding or r.encoding.lower() in ("iso-8859-1", "ascii"):
        m = re.search(rb'charset=["\']?([\w-]+)', r.content[:3000])
        r.encoding = m.group(1).decode() if m else "utf-8"
    art = extract(r.text, str(r.url))
    if len(art["text"]) < 150 and len(art["description"]) < 50:
        raise ArticleError("기사 본문을 찾지 못했습니다 (로그인·유료 기사이거나 본문이 스크립트로만 나오는 사이트일 수 있음). "
                           "다른 언론사의 같은 기사 주소로 시도해 보세요.")
    return art
