"""🧩 어린이 그림자 퀴즈."""
import json
import random

import numpy as np
import pytest
from PIL import Image, ImageDraw

from agent.quiz import THEMES, collect_items, items_from_folder, make_silhouette, quiz_meta


def _cute(transparent=True, bg=(0, 0, 0, 0)):
    img = Image.new("RGBA", (400, 400), bg if not transparent else (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse((100, 120, 300, 360), fill=(200, 120, 60, 255))
    d.ellipse((130, 40, 270, 180), fill=(200, 120, 60, 255))
    return img


def test_silhouette_modes():
    sil, mode = make_silhouette(_cute())
    assert mode == "silhouette"
    a = np.array(sil)
    assert tuple(a[240, 200][:3]) == (35, 35, 75) and a[10, 10][3] == 0          # 몸은 남색 그림자, 배경 투명
    white = _cute(False, (255, 255, 255, 255))
    assert make_silhouette(white)[1] == "silhouette"                              # 흰 배경도 그림자
    photo = Image.fromarray((np.random.default_rng(0).integers(0, 255, (400, 400, 3))).astype(np.uint8))
    assert make_silhouette(photo)[1] == "mosaic"                                  # 사진은 모자이크


def test_themes_are_copyright_free_subjects():
    for key, (label, pool) in THEMES.items():
        assert len(pool) >= 10, key
        assert not any(w in ko for ko, _ in pool for w in ("뽀로로", "티니핑", "포켓몬", "핑크퐁"))


class Fake:
    def __init__(self):
        self.queries = []

    def search(self, q):
        self.queries.append(q)
        return [{"url": q, "source": "pixabay", "author": "a", "page": "p", "license": "Pixabay"}]

    def download_image(self, url):
        return _cute()


class Empty:
    def search(self, q):
        return []


def test_collect_items_prefers_vectors(tmp_path):
    vec = Fake()
    items = collect_items("dinosaurs", 5, tmp_path, {"pixabay_vector": vec, "pixabay_illust": Empty(),
                                                     "pixabay": Empty(), "commons": Empty()}, seed=3)
    assert len(items) == 5 and len({i["answer"] for i in items}) == 5
    assert all(q.endswith(" cartoon") for q in vec.queries)
    assert all((tmp_path / f"item_{k:02d}.png").exists() for k in range(5))


def test_items_from_folder(tmp_path):
    for name in ("01_냥냥이.png", "02-멍멍이.jpg", "readme.txt"):
        (tmp_path / name).write_bytes(b"x")
    items = items_from_folder(tmp_path, 10)
    assert [i["answer"] for i in items] == ["냥냥이", "멍멍이"] and items[0]["source"] == "user"


def test_quiz_meta_credits_and_kids():
    items = [{"answer": "펭귄", "source": "pixabay", "author": "작가", "page": "https://pixabay.com/1"},
             {"answer": "기린", "source": "wikimedia_commons", "author": "Kim", "license": "CC BY-SA 4.0",
              "title": "File:Giraffe.jpg", "page": "https://commons.wikimedia.org/x"}]
    m = quiz_meta(items, "동물", kids=True, cta_style="soft")
    assert m["made_for_kids"] is True and m["category_id"] == "27"
    assert "via Wikimedia Commons" in m["description"] and "Pixabay" in m["description"]
    assert "구독" not in m["description"] and "보호자" in m["description"]


@pytest.mark.slow
def test_make_quiz_end_to_end(settings):
    from agent.models import Production, session_scope
    from agent.quiz import make_quiz
    settings.production.tts_provider = "dummy"
    pid = make_quiz("animals", 10, settings=settings, seed=1,
                    clients={"pixabay_vector": Fake(), "pixabay_illust": Empty(), "pixabay": Empty(), "commons": Empty()})
    p = session_scope(settings.db_url).get(Production, pid)
    assert p.status == "produced", p.error
    assert 50 < p.duration <= 60
    from pathlib import Path
    meta = json.loads((Path(p.video_path).parent / "meta.json").read_text(encoding="utf-8"))
    assert len(meta["items"]) == 10 and meta["made_for_kids"] is True and set(meta["modes"]) == {"silhouette"}
