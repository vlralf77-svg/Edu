"""Phase 5-1: mood 8종 30/60초 BGM, 재현성, 라이브러리 라이선스 검사, mood 분석."""
import json

import numpy as np
import pytest
import soundfile as sf

from agent.production.bgm import library
from agent.production.bgm.generator import compose, generate_bgm, seed_for
from agent.production.bgm.mood import MOODS, analyze_mood, clamp, heuristic

from .conftest import FakeLLM

SF = "assets/soundfonts/FluidR3_GM.sf2"  # 없으면 시스템 FluidR3_GM 사용


@pytest.mark.slow
@pytest.mark.parametrize("mood", MOODS)
@pytest.mark.parametrize("seconds", [30, 60])
def test_generate_each_mood(tmp_path, mood, seconds):
    from pathlib import Path
    path, meta = generate_bgm(mood, seconds, 42, tmp_path, Path(SF))
    audio, sr = sf.read(str(path), always_2d=True)
    assert abs(len(audio) / sr - (seconds + 0.5)) <= 0.2          # 길이 오차 ±0.2초
    assert np.max(np.abs(audio)) < 0.99                            # 클리핑 없음
    assert np.sqrt(np.mean(audio ** 2)) > 0.01                     # 무음 아님
    lo, hi = {"upbeat": (115, 128), "news": (95, 110), "tense": (100, 120), "inspiring": (90, 105),
              "calm": (75, 90), "tech": (110, 124), "funny": (120, 135), "sad": (65, 80)}[mood]
    assert lo <= meta["bpm"] <= hi
    saved = json.loads((tmp_path / "bgm_meta.json").read_text(encoding="utf-8"))
    for k in ("mood", "bpm", "key", "progression", "seed", "soundfont", "soundfont_license", "created_at"):
        assert k in saved
    if mood == "sad":
        assert meta["drums"] == "none" and meta["hook_impact_sec"] is None
    else:
        assert meta["hook_impact_sec"] is not None and meta["hook_impact_sec"] <= 3.0


def _notes(pm):
    return [(i.program, i.is_drum, n.pitch, round(n.start, 4), n.velocity) for i in pm.instruments for n in i.notes]


def test_same_seed_same_music_different_seed_different():
    a, ma = compose("news", 30, 7)
    b, mb = compose("news", 30, 7)
    c, mc = compose("news", 30, 8)
    assert _notes(a) == _notes(b) and ma == mb
    assert _notes(a) != _notes(c)


@pytest.mark.slow
def test_render_reproducible(tmp_path):
    from pathlib import Path
    p1, _ = generate_bgm("calm", 10, 5, tmp_path / "a", Path(SF))
    p2, _ = generate_bgm("calm", 10, 5, tmp_path / "b", Path(SF))
    p3, _ = generate_bgm("calm", 10, 6, tmp_path / "c", Path(SF))
    a1, a2, a3 = (sf.read(str(p))[0] for p in (p1, p2, p3))
    assert np.allclose(a1, a2, atol=1e-3)
    assert not np.allclose(a1, a3, atol=1e-3)


def test_melody_avoids_mid_range():
    pm, _ = compose("upbeat", 30, 3)
    mel = [i for i in pm.instruments if i.name == "melody"][0]
    assert mel.notes and all(n.pitch >= 84 for n in mel.notes)


def test_seed_for_stable():
    assert seed_for("2026-11-25", "a") == seed_for("2026-11-25", "a") != seed_for("2026-11-26", "a")


def _track(dir_, name, lic=None, mood=("news",)):
    p = dir_ / f"{name}.wav"
    sf.write(str(p), np.zeros(4410, dtype=np.float32), 44100)
    if lic is not None:
        (dir_ / f"{name}.license.json").write_text(json.dumps(
            {"title": name, "source": "YouTube 오디오 보관함", "license": lic, "attribution": "", "mood": list(mood),
             "bpm": 100}, ensure_ascii=False), encoding="utf-8")
    return p


def test_library_rejects_missing_and_nc_licenses(tmp_path):
    _track(tmp_path, "ok", "출처 표기 불필요")
    _track(tmp_path, "nolicense")
    _track(tmp_path, "nc", "CC BY-NC 4.0")
    _track(tmp_path, "nd", "CC BY-ND")
    _track(tmp_path, "kr", "비상업적 이용만 가능")
    _track(tmp_path, "by", "CC BY 4.0")
    ok, rejected = library.scan(tmp_path)
    assert sorted(t.path.stem for t in ok) == ["by", "ok"]
    assert sorted(p.stem for p, _ in rejected) == ["kr", "nc", "nd", "nolicense"]
    with pytest.raises(library.LicenseError):
        library.load_track(tmp_path / "nc.wav")


def test_library_shared_license_only_for_single_track_folder(tmp_path):
    d = tmp_path / "album"
    d.mkdir()
    _track(d, "a")
    (d / "license.json").write_text(json.dumps({"license": "CC0", "mood": ["calm"]}), encoding="utf-8")
    assert len(library.scan(tmp_path)[0]) == 1
    _track(d, "b")
    assert library.scan(tmp_path)[0] == []


def test_library_choose_and_prepare(tmp_path):
    _track(tmp_path, "t1", "CC0", ("tense",))
    _track(tmp_path, "t2", "CC0", ("news",))
    ok, _ = library.scan(tmp_path)
    tr = library.choose(ok, "news", 100, set())
    assert tr.path.stem == "t2"
    assert library.choose(ok, "news", 100, {str(tr.path)}) is None
    out, meta = library.prepare(tr, 5.0, tmp_path / "out", 0.5, 1.5)
    assert abs(sf.info(str(out)).duration - 5.5) < 0.05 and meta["type"] == "library"


def test_mood_analysis_clamps_and_falls_back():
    m = analyze_mood(FakeLLM(), {"title": "AI", "scenes": [{"narration": "AI 칩 공개"}]})
    assert m["mood"] == "tech" and m["tempo_bpm"] == 124  # 200 → 범위 상한
    assert heuristic("오늘 추모 행사가 열렸습니다")["mood"] == "sad"
    assert heuristic("평범한 문장")["mood"] == "news"
    assert clamp({"mood": "weird", "energy": 5})["mood"] == "news"
    assert analyze_mood(None, {"title": "", "scenes": [{"narration": "화재 사고 발생"}]})["mood"] == "tense"
