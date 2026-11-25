"""장면 비주얼 확보: Pexels/Pixabay 무료 스톡 사진 → 9:16 크롭. 실패 시 단색 배경 + 키워드 타이포그래피.

라이선스·출처는 visual_meta 로 저장한다. 타인 YouTube 영상/썸네일은 절대 사용하지 않는다.
"""
from __future__ import annotations

import hashlib
import io
import logging
import textwrap
from pathlib import Path

import httpx
from PIL import Image, ImageDraw, ImageFilter
from tenacity import retry, stop_after_attempt, wait_exponential

from ..config import env
from .fonts import font

log = logging.getLogger(__name__)

PALETTES = [((20, 24, 46), (72, 52, 160)), ((14, 40, 52), (16, 120, 130)), ((48, 18, 30), (170, 50, 70)),
            ((22, 22, 22), (90, 90, 100)), ((16, 36, 24), (40, 130, 80)), ((40, 30, 10), (190, 120, 30))]


def crop_vertical(img: Image.Image, size: tuple[int, int]) -> Image.Image:
    w, h = size
    img = img.convert("RGB")
    scale = max(w / img.width, h / img.height)
    img = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
    left, top = (img.width - w) // 2, (img.height - h) // 2
    return img.crop((left, top, left + w, top + h))


def typography_card(text: str, query: str, size: tuple[int, int], out: Path, font_path: str = "") -> dict:
    w, h = size
    seed = int(hashlib.md5((text + query).encode()).hexdigest(), 16)
    c1, c2 = PALETTES[seed % len(PALETTES)]
    img = Image.new("RGB", size, c1)
    grad = Image.linear_gradient("L").resize(size)
    img = Image.composite(Image.new("RGB", size, c2), img, grad)
    d = ImageDraw.Draw(img)
    for i in range(6):  # 은은한 원형 장식
        r = (seed >> (i * 4)) % 300 + 150
        cx, cy = (seed >> (i * 3)) % w, (seed >> (i * 5)) % h
        d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=(255, 255, 255), width=2)
    img = img.filter(ImageFilter.GaussianBlur(2))
    d = ImageDraw.Draw(img)
    label = text or query
    f = font(130, font_path)
    lines = textwrap.wrap(label, 7) or [label]
    y = h // 2 - len(lines) * 80
    for line in lines:
        tw = d.textlength(line, font=f)
        d.text(((w - tw) / 2, y), line, font=f, fill="white", stroke_width=4, stroke_fill=(0, 0, 0))
        y += 170
    img.save(out, quality=92)
    return {"source": "generated", "kind": "typography", "license": "자체 생성", "query": query}


class StockSearch:
    def __init__(self, provider: str, http: httpx.Client | None = None):
        self.provider = provider
        self.http = http or httpx.Client(timeout=30, follow_redirects=True)

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=8), reraise=True)
    def search(self, query: str) -> list[dict]:
        if self.provider == "pexels":
            key = env("PEXELS_API_KEY")
            if not key:
                return []
            r = self.http.get("https://api.pexels.com/v1/search", headers={"Authorization": key},
                              params={"query": query, "orientation": "portrait", "per_page": 10})
            r.raise_for_status()
            return [{"url": p["src"]["large2x"], "page": p["url"], "author": p.get("photographer", ""),
                     "license": "Pexels License (무료 상업적 이용, 출처 표기 권장)", "source": "pexels"}
                    for p in r.json().get("photos", [])]
        if self.provider == "pixabay":
            key = env("PIXABAY_API_KEY")
            if not key:
                return []
            r = self.http.get("https://pixabay.com/api/", params={
                "key": key, "q": query, "image_type": "photo", "orientation": "vertical", "safesearch": "true",
                "per_page": 10})
            r.raise_for_status()
            return [{"url": p["largeImageURL"], "page": p["pageURL"], "author": p.get("user", ""),
                     "license": "Pixabay Content License (무료 상업적 이용)", "source": "pixabay"}
                    for p in r.json().get("hits", [])]
        return []

    def download(self, url: str) -> Image.Image:
        r = self.http.get(url)
        r.raise_for_status()
        return Image.open(io.BytesIO(r.content))


def fetch_visual(scene: dict, out: Path, size: tuple[int, int], provider: str, used: set[str],
                 search: StockSearch | None = None, font_path: str = "") -> dict:
    """장면 1개 이미지 확보. 같은 영상 안에서 같은 사진 반복을 피한다."""
    query = scene.get("visual_query", "")
    if provider in ("pexels", "pixabay") and query:
        search = search or StockSearch(provider)
        try:
            for cand in search.search(query):
                if cand["url"] in used:
                    continue
                img = crop_vertical(search.download(cand["url"]), size)
                img.save(out, quality=92)
                used.add(cand["url"])
                return {**cand, "query": query}
        except Exception as e:  # 네트워크/쿼터 문제 → 대체 카드
            log.warning("스톡 검색 실패(%s): %s → 타이포그래피 대체", query, e)
    return typography_card(scene.get("on_screen_text", ""), query, size, out, font_path)


def title_overlay(text: str, size: tuple[int, int], out: Path, font_path: str = "") -> None:
    """on_screen_text 상단 타이틀 (투명 PNG)."""
    w, h = size
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    if text:
        d = ImageDraw.Draw(img)
        f = font(92, font_path)
        tw = d.textlength(text, font=f)
        pad, y = 36, int(h * 0.12)
        d.rounded_rectangle(((w - tw) / 2 - pad, y - 20, (w + tw) / 2 + pad, y + 130), 28, fill=(0, 0, 0, 150))
        d.text(((w - tw) / 2, y), text, font=f, fill=(255, 225, 60), stroke_width=3, stroke_fill=(0, 0, 0))
    img.save(out)
