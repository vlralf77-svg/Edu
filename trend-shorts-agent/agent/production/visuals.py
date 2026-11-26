"""장면 비주얼 확보.

우선순위 (settings.production.visual_sources 순서):
  1. commons       — 장면의 실존 인물·기관·장소(visual_subject) 사진: Wikimedia Commons, 상업 이용 가능 라이선스만
  2. pexels_video  — 실제 촬영 스톡 영상 클립 (Pexels License, 무료 상업 이용)
  3. pixabay_video — 실제 촬영 스톡 영상 클립 (Pixabay Content License)
  4. pexels / pixabay — 스톡 사진
  마지막 대체: 그라디언트 + 키워드 타이포그래피 카드

라이선스·출처·작가는 메타로 저장해 영상 설명란 크레딧에 넣는다.
타인 YouTube 영상/썸네일·뉴스 방송 화면은 저작권 때문에 절대 사용하지 않는다.
"""
from __future__ import annotations

import hashlib
import html
import io
import logging
import re
import textwrap
from pathlib import Path

import httpx
from PIL import Image, ImageDraw, ImageFilter
from tenacity import retry, stop_after_attempt, wait_exponential

from ..config import env
from .fonts import font

log = logging.getLogger(__name__)

# Wikimedia 정책상 식별 가능한 User-Agent 필요 (개인 정보는 넣지 않음)
USER_AGENT = "trend-shorts-agent/0.1 (automated short-form news tool; python-httpx)"
PALETTES = [((20, 24, 46), (72, 52, 160)), ((14, 40, 52), (16, 120, 130)), ((48, 18, 30), (170, 50, 70)),
            ((22, 22, 22), (90, 90, 100)), ((16, 36, 24), (40, 130, 80)), ((40, 30, 10), (190, 120, 30))]

# 상업 이용 + 수정(크롭) 가능한 라이선스만 허용
COMMONS_ALLOWED = re.compile(r"^(cc0|public domain|pd\b|pd-|cc[ -]by(-sa)?[ -]?\d|cc[ -]by(-sa)?$|attribution)", re.I)
COMMONS_FORBIDDEN = re.compile(r"(\bnc\b|\bnd\b|-nc|-nd|non-?commercial|no ?deriv|fair use)", re.I)
SKIP_TITLE = re.compile(r"(logo|icon|flag|map|coat.of.arms|signature|symbol|\.svg)", re.I)


# ---------------------------------------------------------------- 이미지 가공
def crop_vertical(img: Image.Image, size: tuple[int, int]) -> Image.Image:
    w, h = size
    img = img.convert("RGB")
    scale = max(w / img.width, h / img.height)
    img = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
    left, top = (img.width - w) // 2, (img.height - h) // 2
    return img.crop((left, top, left + w, top + h))


def fit_with_blur(img: Image.Image, size: tuple[int, int]) -> Image.Image:
    """가로 사진(인물 사진 등)을 얼굴이 잘리지 않게 세로 화면에 맞춤: 흐린 배경 + 가운데 원본."""
    w, h = size
    img = img.convert("RGB")
    if img.width / img.height <= w / h * 1.15:  # 이미 세로에 가까우면 그냥 크롭
        return crop_vertical(img, size)
    bg = crop_vertical(img, size).filter(ImageFilter.GaussianBlur(40))
    bg = Image.blend(bg, Image.new("RGB", size, (0, 0, 0)), 0.35)
    scale = w / img.width
    fg = img.resize((w, round(img.height * scale)), Image.LANCZOS)
    bg.paste(fg, (0, (h - fg.height) // 2))
    return bg


def typography_card(text: str, query: str, size: tuple[int, int], out: Path, font_path: str = "") -> dict:
    w, h = size
    seed = int(hashlib.md5((text + query).encode()).hexdigest(), 16)
    c1, c2 = PALETTES[seed % len(PALETTES)]
    img = Image.new("RGB", size, c1)
    grad = Image.linear_gradient("L").resize(size)
    img = Image.composite(Image.new("RGB", size, c2), img, grad)
    d = ImageDraw.Draw(img)
    for i in range(6):
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
    return {"source": "generated", "kind": "card", "license": "자체 생성", "query": query, "path": str(out)}


# ---------------------------------------------------------------- 검색 클라이언트
class _Client:
    def __init__(self, http: httpx.Client | None = None):
        self.http = http or httpx.Client(timeout=30, follow_redirects=True, headers={"User-Agent": USER_AGENT})

    def download(self, url: str, out: Path, max_mb: float = 80) -> Path:
        with self.http.stream("GET", url) as r:
            r.raise_for_status()
            size = 0
            with open(out, "wb") as f:
                for chunk in r.iter_bytes(1 << 16):
                    size += len(chunk)
                    if size > max_mb * 1024 * 1024:
                        raise ValueError(f"파일이 너무 큼 (> {max_mb}MB): {url}")
                    f.write(chunk)
        return out

    def download_image(self, url: str) -> Image.Image:
        r = self.http.get(url)
        r.raise_for_status()
        return Image.open(io.BytesIO(r.content))


class StockPhotoSearch(_Client):
    def __init__(self, provider: str, http: httpx.Client | None = None):
        super().__init__(http)
        self.provider = provider

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=8), reraise=True)
    def search(self, query: str) -> list[dict]:
        if self.provider == "pexels" and (key := env("PEXELS_API_KEY")):
            r = self.http.get("https://api.pexels.com/v1/search", headers={"Authorization": key},
                              params={"query": query, "orientation": "portrait", "per_page": 10})
            r.raise_for_status()
            return [{"url": p["src"]["large2x"], "page": p["url"], "author": p.get("photographer", ""),
                     "license": "Pexels License (무료 상업적 이용)", "source": "pexels"}
                    for p in r.json().get("photos", [])]
        if self.provider == "pixabay" and (key := env("PIXABAY_API_KEY")):
            r = self.http.get("https://pixabay.com/api/", params={
                "key": key, "q": query, "image_type": "photo", "orientation": "vertical", "safesearch": "true",
                "per_page": 10})
            r.raise_for_status()
            return [{"url": p["largeImageURL"], "page": p["pageURL"], "author": p.get("user", ""),
                     "license": "Pixabay Content License (무료 상업적 이용)", "source": "pixabay"}
                    for p in r.json().get("hits", [])]
        return []


# 하위 호환
StockSearch = StockPhotoSearch


def _pick_file(files: list[dict], target_h: int = 1920) -> dict | None:
    """세로 해상도가 목표에 가장 가깝고(너무 크지 않게) mp4 인 파일 선택."""
    cands = [f for f in files if f.get("link") or f.get("url")]
    cands = [f for f in cands if (f.get("file_type") or "video/mp4") == "video/mp4" and (f.get("height") or 0) >= 640]
    if not cands:
        return None
    return min(cands, key=lambda f: (abs(min(f["height"], f["width"]) - 1080), f["height"] * f["width"]))


class StockVideoSearch(_Client):
    def __init__(self, provider: str, http: httpx.Client | None = None):
        super().__init__(http)
        self.provider = provider

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=8), reraise=True)
    def search(self, query: str, min_duration: float = 3) -> list[dict]:
        out = []
        if self.provider == "pexels_video" and (key := env("PEXELS_API_KEY")):
            r = self.http.get("https://api.pexels.com/videos/search", headers={"Authorization": key},
                              params={"query": query, "orientation": "portrait", "per_page": 10})
            r.raise_for_status()
            for v in r.json().get("videos", []):
                f = _pick_file(v.get("video_files", []))
                if f and v.get("duration", 0) >= min_duration:
                    out.append({"url": f["link"], "page": v.get("url", ""), "author": v.get("user", {}).get("name", ""),
                                "width": f["width"], "height": f["height"], "duration": v["duration"],
                                "license": "Pexels License (무료 상업적 이용)", "source": "pexels"})
        elif self.provider == "pixabay_video" and (key := env("PIXABAY_API_KEY")):
            r = self.http.get("https://pixabay.com/api/videos/", params={
                "key": key, "q": query, "safesearch": "true", "per_page": 10})
            r.raise_for_status()
            for v in r.json().get("hits", []):
                files = [{"url": x.get("url"), "link": x.get("url"), "width": x.get("width", 0),
                          "height": x.get("height", 0)} for x in v.get("videos", {}).values() if x.get("url")]
                f = _pick_file(files)
                if f and v.get("duration", 0) >= min_duration:
                    out.append({"url": f["link"], "page": v.get("pageURL", ""), "author": v.get("user", ""),
                                "width": f["width"], "height": f["height"], "duration": v["duration"],
                                "license": "Pixabay Content License (무료 상업적 이용)", "source": "pixabay"})
        # 세로 영상 우선
        out.sort(key=lambda c: 0 if c["height"] >= c["width"] else 1)
        return out


def _strip_html(s: str) -> str:
    return html.unescape(re.sub(r"<[^>]+>", "", s or "")).strip()


def commons_license_ok(short_name: str) -> bool:
    s = (short_name or "").strip()
    return bool(s) and bool(COMMONS_ALLOWED.search(s)) and not COMMONS_FORBIDDEN.search(s)


class CommonsSearch(_Client):
    """Wikimedia Commons: 실존 인물·기관·장소의 자유 라이선스 사진 (API 키 불필요)."""

    API = "https://commons.wikimedia.org/w/api.php"

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=8), reraise=True)
    def search(self, subject: str) -> list[dict]:
        r = self.http.get(self.API, params={
            "action": "query", "format": "json", "generator": "search", "gsrnamespace": 6,
            "gsrsearch": f"{subject} filetype:bitmap", "gsrlimit": 15, "prop": "imageinfo",
            "iiprop": "url|extmetadata|size|mime", "iiurlwidth": 1600})
        r.raise_for_status()
        pages = sorted(r.json().get("query", {}).get("pages", {}).values(), key=lambda p: p.get("index", 0))
        out = []
        for p in pages:
            title = p.get("title", "")
            info = (p.get("imageinfo") or [{}])[0]
            meta = info.get("extmetadata", {})
            lic = meta.get("LicenseShortName", {}).get("value", "")
            if SKIP_TITLE.search(title) or info.get("mime") not in ("image/jpeg", "image/png"):
                continue
            if (info.get("width") or 0) < 600 or not commons_license_ok(lic):
                continue
            out.append({
                "url": info.get("thumburl") or info.get("url"), "page": info.get("descriptionurl", ""),
                "author": _strip_html(meta.get("Artist", {}).get("value", "")) or "unknown",
                "license": lic, "license_url": meta.get("LicenseUrl", {}).get("value", ""),
                "source": "wikimedia_commons", "title": title, "subject": subject,
                "note": "실존 인물 사진은 보도·해설 맥락에서만 사용 (초상권 주의)",
            })
        return out


# ---------------------------------------------------------------- 장면별 선택
class VisualFetcher:
    """한 영상 안에서 같은 소스 반복을 피하면서 장면별 비주얼을 확보한다."""

    def __init__(self, sources: list[str], size: tuple[int, int], font_path: str = "", clients: dict | None = None,
                 max_per_subject: int = 2, max_clip_mb: float = 80):
        self.sources = sources
        self.size = size
        self.font_path = font_path
        self.clients = clients or {}
        self.max_per_subject = max_per_subject
        self.max_clip_mb = max_clip_mb
        self.used: set[str] = set()
        self.subject_count: dict[str, int] = {}

    def client(self, name: str):
        if name not in self.clients:
            if name == "commons":
                self.clients[name] = CommonsSearch()
            elif name.endswith("_video"):
                self.clients[name] = StockVideoSearch(name)
            else:
                self.clients[name] = StockPhotoSearch(name)
        return self.clients[name]

    def _try(self, source: str, scene: dict, base: Path, duration: float) -> dict | None:
        query = scene.get("visual_query", "")
        subject = (scene.get("visual_subject") or "").strip()
        if source == "commons":
            if not subject or self.subject_count.get(subject, 0) >= self.max_per_subject:
                return None
            for c in self.client(source).search(subject):
                if c["url"] in self.used:
                    continue
                out = base.with_suffix(".jpg")
                fit_with_blur(self.client(source).download_image(c["url"]), self.size).save(out, quality=92)
                self.used.add(c["url"])
                self.subject_count[subject] = self.subject_count.get(subject, 0) + 1
                return {**c, "kind": "image", "path": str(out)}
            return None
        if not query:
            return None
        if source.endswith("_video"):
            for c in self.client(source).search(query, min_duration=min(duration, 5)):
                if c["url"] in self.used:
                    continue
                out = base.with_suffix(".mp4")
                self.client(source).download(c["url"], out, self.max_clip_mb)
                self.used.add(c["url"])
                return {**c, "kind": "video", "query": query, "path": str(out)}
            return None
        for c in self.client(source).search(query):
            if c["url"] in self.used:
                continue
            out = base.with_suffix(".jpg")
            crop_vertical(self.client(source).download_image(c["url"]), self.size).save(out, quality=92)
            self.used.add(c["url"])
            return {**c, "kind": "image", "query": query, "path": str(out)}
        return None

    def fetch(self, scene: dict, base: Path, duration: float) -> dict:
        for source in self.sources:
            try:
                got = self._try(source, scene, base, duration)
            except Exception as e:  # 네트워크/쿼터/라이선스 문제 → 다음 소스
                log.warning("%s 실패(%s): %s", source, scene.get("visual_subject") or scene.get("visual_query"), e)
                continue
            if got:
                return got
        log.info("장면 %s: 쓸 수 있는 영상/사진 없음 → 타이포그래피 카드", scene.get("idx"))
        return typography_card(scene.get("on_screen_text", ""), scene.get("visual_query", ""), self.size,
                               base.with_suffix(".jpg"), self.font_path)


def fetch_visual(scene: dict, out: Path, size: tuple[int, int], provider: str, used: set[str],
                 search=None, font_path: str = "") -> dict:
    """사진 1장 확보 (단일 provider, 하위 호환용)."""
    fetcher = VisualFetcher([provider] if provider in ("pexels", "pixabay") else [], size, font_path,
                            clients={provider: search} if search else None)
    fetcher.used = used
    return fetcher.fetch(scene, out.with_suffix(""), 5.0)


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


def cta_overlay(overlay_path: Path, style: str, font_path: str = "") -> None:
    """마지막 장면 오버레이(상단 타이틀 PNG)에 [▶ 구독] [♥ 좋아요] 버튼 그래픽(또는 인사)을 합성."""
    img = Image.open(overlay_path).convert("RGBA")
    w, h = img.size
    d = ImageDraw.Draw(img)
    f = font(76, font_path)
    y = int(h * 0.60)
    if style == "direct":
        buttons = [("▶ 구독", (230, 33, 23), (255, 255, 255)), ("♥ 좋아요", (255, 255, 255), (30, 30, 30))]
        widths = [d.textlength(t, font=f) + 90 for t, _, _ in buttons]
        x = (w - sum(widths) - 40) / 2
        for (t, bg, fg), bw in zip(buttons, widths):
            d.rounded_rectangle((x + 6, y + 8, x + bw + 6, y + 128), 60, fill=(0, 0, 0, 90))  # 그림자
            d.rounded_rectangle((x, y, x + bw, y + 120), 60, fill=bg + (245,))
            d.text((x + 45, y + 16), t, font=f, fill=fg)
            x += bw + 40
    else:  # soft: 다정한 인사
        t = "또 만나요! 👋".replace("👋", "~")
        tw = d.textlength(t, font=f)
        d.rounded_rectangle(((w - tw) / 2 - 50, y, (w + tw) / 2 + 50, y + 120), 60, fill=(255, 196, 0, 240))
        d.text(((w - tw) / 2, y + 16), t, font=f, fill=(40, 30, 0))
    img.save(overlay_path)
