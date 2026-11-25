"""실제 영상·인물 사진 비주얼: Commons 라이선스 필터, 스톡 영상 파싱, 소스 우선순위, 영상 클립이 들어간 최종 합성."""
import json
import shutil
import subprocess

import httpx
import pytest
from PIL import Image

from agent.production.visuals import (
    CommonsSearch, StockVideoSearch, VisualFetcher, commons_license_ok, fit_with_blur,
)

SIZE = (1080, 1920)


@pytest.mark.parametrize("lic,ok", [
    ("CC BY-SA 4.0", True), ("CC BY 2.0", True), ("CC0", True), ("Public domain", True), ("CC BY-SA 3.0 de", True),
    ("CC BY-NC 2.0", False), ("CC BY-ND 4.0", False), ("CC BY-NC-SA 3.0", False), ("", False), ("Fair use", False),
    ("All rights reserved", False),
])
def test_commons_license_filter(lic, ok):
    assert commons_license_ok(lic) is ok


def _commons_transport():
    def page(i, title, lic, mime="image/jpeg", width=2000):
        return {"index": i, "title": title, "imageinfo": [{
            "url": f"https://upload.example/{i}.jpg", "thumburl": f"https://upload.example/thumb/{i}.jpg",
            "descriptionurl": f"https://commons.wikimedia.org/wiki/{title}", "mime": mime, "width": width,
            "extmetadata": {"LicenseShortName": {"value": lic}, "Artist": {"value": "<a href='x'>Kim &amp; Lee</a>"},
                            "LicenseUrl": {"value": "https://creativecommons.org/licenses/by-sa/4.0"}}}]}

    def handler(req):
        assert req.headers["User-Agent"].startswith("trend-shorts-agent")
        assert "Son Heung-min" in req.url.params["gsrsearch"]
        pages = [page(1, "File:Son Heung-min 2022.jpg", "CC BY-SA 4.0"),
                 page(2, "File:Tottenham logo.png", "CC BY-SA 4.0", mime="image/png"),
                 page(3, "File:Son NC.jpg", "CC BY-NC 2.0"),
                 page(4, "File:Son tiny.jpg", "CC0", width=300),
                 page(0, "File:Son Heung-min 2019.jpg", "CC BY 2.0")]
        return httpx.Response(200, json={"query": {"pages": {str(p["index"]): p for p in pages}}})
    return httpx.MockTransport(handler)


def test_commons_search_parses_and_filters():
    c = CommonsSearch(http=httpx.Client(transport=_commons_transport(),
                                        headers={"User-Agent": "trend-shorts-agent/test"}))
    res = c.search("Son Heung-min")
    assert [r["title"] for r in res] == ["File:Son Heung-min 2019.jpg", "File:Son Heung-min 2022.jpg"]
    assert res[0]["author"] == "Kim & Lee" and res[0]["url"].endswith("thumb/0.jpg")
    assert res[0]["source"] == "wikimedia_commons" and res[0]["license"] == "CC BY 2.0"


def test_pexels_video_search_prefers_portrait_and_hd(monkeypatch):
    monkeypatch.setenv("PEXELS_API_KEY", "k")

    def handler(req):
        assert req.url.params["orientation"] == "portrait"
        return httpx.Response(200, json={"videos": [
            {"url": "https://pexels.com/v/1", "duration": 12, "user": {"name": "A"}, "video_files": [
                {"link": "https://v/1-sd.mp4", "width": 640, "height": 360, "file_type": "video/mp4"},
                {"link": "https://v/1-hd.mp4", "width": 1920, "height": 1080, "file_type": "video/mp4"}]},
            {"url": "https://pexels.com/v/2", "duration": 9, "user": {"name": "B"}, "video_files": [
                {"link": "https://v/2-4k.mp4", "width": 2160, "height": 3840, "file_type": "video/mp4"},
                {"link": "https://v/2-hd.mp4", "width": 1080, "height": 1920, "file_type": "video/mp4"}]},
            {"url": "https://pexels.com/v/3", "duration": 2, "user": {"name": "C"}, "video_files": [
                {"link": "https://v/3.mp4", "width": 1080, "height": 1920, "file_type": "video/mp4"}]},
        ]})

    s = StockVideoSearch("pexels_video", http=httpx.Client(transport=httpx.MockTransport(handler)))
    res = s.search("crowd cheering stadium", min_duration=4)
    assert [r["url"] for r in res] == ["https://v/2-hd.mp4", "https://v/1-hd.mp4"]  # 세로 우선, 너무 짧은 클립 제외
    assert res[0]["author"] == "B" and res[0]["license"].startswith("Pexels")


def test_no_keys_returns_empty(monkeypatch):
    monkeypatch.delenv("PEXELS_API_KEY", raising=False)
    monkeypatch.delenv("PIXABAY_API_KEY", raising=False)
    assert StockVideoSearch("pexels_video").search("x") == []
    assert StockVideoSearch("pixabay_video").search("x") == []


def test_fit_with_blur_keeps_whole_landscape_photo():
    img = Image.new("RGB", (2000, 1000), "red")
    out = fit_with_blur(img, SIZE)
    assert out.size == SIZE
    assert out.getpixel((540, 960))[0] > 200          # 가운데: 원본 사진
    assert out.getpixel((540, 50))[0] < 200           # 위쪽: 어둡게 흐린 배경


# ---------------------------------------------------------------- 가짜 소스
@pytest.fixture(scope="module")
def sample_clip(tmp_path_factory):
    p = tmp_path_factory.mktemp("clip") / "clip.mp4"
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=25:d=3",
                    "-c:v", "libx264", "-pix_fmt", "yuv420p", str(p)], check=True)
    return p


class FakeVideo:
    def __init__(self, clip, n=10):
        self.clip, self.n, self.queries = clip, n, []

    def search(self, query, min_duration=3):
        self.queries.append(query)
        return [{"url": f"https://v/{i}.mp4", "page": f"https://pexels.com/{i}", "author": f"작가{i}",
                 "license": "Pexels License", "source": "pexels", "width": 1280, "height": 720, "duration": 10}
                for i in range(self.n)]

    def download(self, url, out, max_mb=80):
        shutil.copy(self.clip, out)
        return out


class FakeCommons:
    def __init__(self):
        self.subjects = []

    def search(self, subject):
        self.subjects.append(subject)
        return [{"url": f"https://c/{subject}/{i}.jpg", "page": "p", "author": "Kim", "license": "CC BY-SA 4.0",
                 "source": "wikimedia_commons", "title": f"File:{subject} {i}.jpg", "subject": subject}
                for i in range(3)]

    def download_image(self, url):
        return Image.new("RGB", (1600, 1000), "green")


class Broken:
    def search(self, *a, **k):
        raise httpx.ConnectError("offline")


def test_fetcher_priority_subject_then_video_then_card(tmp_path, sample_clip):
    commons, video = FakeCommons(), FakeVideo(sample_clip)
    f = VisualFetcher(["commons", "pexels_video", "pexels"], SIZE,
                      clients={"commons": commons, "pexels_video": video, "pexels": Broken()}, max_per_subject=2)
    scenes = [{"idx": i, "visual_query": f"q{i}", "visual_subject": "Son Heung-min" if i < 4 else "",
               "on_screen_text": "t"} for i in range(1, 6)]
    kinds = [f.fetch(sc, tmp_path / f"s{sc['idx']}", 4.0) for sc in scenes]
    assert [k["kind"] for k in kinds] == ["image", "image", "video", "video", "video"]  # 같은 인물은 최대 2장
    assert kinds[0]["source"] == "wikimedia_commons" and kinds[2]["source"] == "pexels"
    assert len({k["url"] for k in kinds}) == 5                                       # 같은 소스 반복 없음
    # 모든 소스 실패 → 카드
    f2 = VisualFetcher(["commons", "pexels_video"], SIZE, clients={"commons": Broken(), "pexels_video": Broken()})
    card = f2.fetch({"idx": 1, "visual_query": "q", "visual_subject": "X", "on_screen_text": "대체"}, tmp_path / "c", 3)
    assert card["kind"] == "card" and (tmp_path / "c.jpg").exists()


@pytest.mark.slow
def test_produce_with_real_video_clips(settings, monkeypatch, sample_clip):
    from agent.pipeline import produce
    from .conftest import FakeLLM
    from .test_phase5_production import _approved, _sample_script

    settings.production.tts_provider = "dummy"
    settings.production.visual_sources = ["commons", "pexels_video"]
    monkeypatch.setattr("agent.context.RunContext.llm", FakeLLM())
    clients = {"commons": FakeCommons(), "pexels_video": FakeVideo(sample_clip)}
    sid = _approved(settings, _sample_script(settings))
    prod = produce(sid, settings=settings, stock_search=clients)
    assert prod.status == "produced", prod.error
    out = settings.run_dir("2026-11-25") / "production" / f"script_{sid}"
    meta = json.loads((out / "meta.json").read_text(encoding="utf-8"))
    kinds = [v["kind"] for v in meta["visuals"]]
    assert kinds.count("video") == 5 and kinds.count("image") == 1     # 샘플: 인물/기업 1장면 + 영상 5장면
    assert clients["commons"].subjects == ["Samsung Electronics"]
    assert "via Wikimedia Commons" in meta["description"] and "Pexels" in meta["description"]
    from agent.production.composer import probe
    info = probe(out / "final.mp4")
    assert (info["width"], info["height"]) == SIZE and info["duration"] <= 60
