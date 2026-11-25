"""Phase 5: 자막, 덕킹, 비주얼 대체, 전체 제작 (dummy TTS + 생성 비주얼 + 생성 BGM)."""
import json

import numpy as np
import pytest

from agent.context import RunContext
from agent.models import Production, Script, Topic
from agent.pipeline import produce
from agent.production.composer import duck_envelope, speech_segments, validate
from agent.production.subtitles import build_cues, write_ass, write_srt
from agent.production.tts.base import Word, chars_to_words, proportional_words
from agent.production.visuals import fetch_visual
from agent.writing.script_writer import normalize_script

from .conftest import FakeLLM


def test_chars_to_words():
    chars = list("안녕 하세요")
    w = chars_to_words(chars, [i * .1 for i in range(6)], [i * .1 + .1 for i in range(6)])
    assert [(x.text, round(x.start, 2), round(x.end, 2)) for x in w] == [("안녕", 0, 0.2), ("하세요", 0.3, 0.6)]


def test_cues_max_14_chars(tmp_path):
    text = "오늘은 아주 중요한 발표가 있었습니다. 초장문단어테스트입니다아아아아아아아아 끝."
    words = proportional_words(text, 8.0)
    cues = build_cues(words, 14)
    assert all(len(c.text) <= 14 for c in cues)
    assert cues[0].start >= 0 and all(a.end <= b.start + 1e-6 for a, b in zip(cues, cues[1:]))
    write_srt(cues, tmp_path / "a.srt")
    write_ass(cues, tmp_path / "a.ass", "Noto Sans CJK KR", (1080, 1920))
    assert "00:00:00" in (tmp_path / "a.srt").read_text(encoding="utf-8")
    assert "PlayResY: 1920" in (tmp_path / "a.ass").read_text(encoding="utf-8")


def test_duck_envelope_levels():
    n = 44100 * 4
    env = duck_envelope(n, speech_segments([(1.0, 1.5), (1.6, 2.0)]), -12)
    assert env[int(0.3 * 44100)] == pytest.approx(1.0)
    assert env[int(1.7 * 44100)] == pytest.approx(10 ** (-12 / 20), rel=1e-3)  # 짧은 공백은 합쳐서 계속 덕킹
    assert env[int(3.5 * 44100)] == pytest.approx(1.0)


def test_visual_fallback_when_stock_fails(tmp_path):
    class Broken:
        def search(self, q):
            raise RuntimeError("network")

    meta = fetch_visual({"on_screen_text": "테스트", "visual_query": "cat"}, tmp_path / "a.jpg", (1080, 1920),
                        "pexels", set(), Broken())
    assert meta["source"] == "generated" and (tmp_path / "a.jpg").exists()


def test_visual_stock_crop_and_license(tmp_path):
    from PIL import Image

    class Stock:
        def search(self, q):
            return [{"url": "u1", "page": "p", "author": "a", "license": "Pexels License", "source": "pexels"}]

        def download_image(self, url):
            return Image.new("RGB", (4000, 3000), "blue")

    meta = fetch_visual({"visual_query": "sea"}, tmp_path / "b.jpg", (1080, 1920), "pexels", set(), Stock())
    assert meta["license"] == "Pexels License" and meta["query"] == "sea"
    assert Image.open(tmp_path / "b.jpg").size == (1080, 1920)


def test_validate_detects_problems():
    ok = {"duration": 58, "width": 1080, "height": 1920, "has_audio": True, "max_volume_db": -1.2,
          "mean_volume_db": -20}
    assert validate(ok, 60, (1080, 1920)) == []
    assert validate({**ok, "duration": 61}, 60, (1080, 1920))
    assert validate({**ok, "width": 720}, 60, (1080, 1920))
    assert validate({**ok, "max_volume_db": 0.5}, 60, (1080, 1920))


def _sample_script(settings, extra_chars=0):
    from pathlib import Path
    p = Path(__file__).parents[1] / "agent" / "samples" / "sample_script.json"
    script = json.loads(p.read_text(encoding="utf-8"))
    if extra_chars:
        script["scenes"][1]["narration"] += " 추가 문장입니다." * (extra_chars // 8)
    return normalize_script(script, script["topic_id"], settings.script.chars_per_second, set(script["sources"]))


def _approved(settings, script):
    with RunContext("2026-11-25", settings) as ctx:
        t = Topic(run_id=ctx.run.id, key=f"s{len(ctx.run.topics)}", title="샘플")
        ctx.session.add(t)
        ctx.session.flush()
        s = Script(topic_id=t.id, json=script, char_count=script["char_count"],
                   est_seconds=script["estimated_seconds"], approval_status="approved")
        ctx.session.add(s)
        ctx.session.commit()
        return s.id


@pytest.mark.slow
def test_produce_sample_end_to_end(settings, monkeypatch):
    settings.production.tts_provider = "dummy"
    settings.production.visual_sources = []
    monkeypatch.setattr("agent.context.RunContext.llm", FakeLLM())
    sid = _approved(settings, _sample_script(settings))
    prod = produce(sid, settings=settings)
    assert prod.status == "produced", prod.error
    assert prod.duration <= 60
    out = settings.run_dir("2026-11-25") / "production" / f"script_{sid}"
    from agent.production.composer import probe
    info = probe(out / "final.mp4")
    assert (info["width"], info["height"]) == (1080, 1920)
    assert info["max_volume_db"] < 0 and info["mean_volume_db"] > -40
    meta = json.loads((out / "meta.json").read_text(encoding="utf-8"))
    assert meta["synthetic_media"] is True and "출처" in meta["description"]
    bgm = json.loads((out / "bgm_meta.json").read_text(encoding="utf-8"))
    assert bgm["type"] == "generated" and bgm["mood"] == "tech" and 110 <= bgm["bpm"] <= 124
    assert (out / "subtitles.srt").exists()
    with RunContext("2026-11-25", settings) as ctx:
        assert ctx.session.get(Script, sid).approval_status == "produced"
        assert ctx.run.usage.get("tts_chars:dummy", 0) > 250


@pytest.mark.slow
def test_too_long_script_gets_sped_up_or_fails(settings, monkeypatch):
    settings.production.tts_provider = "dummy"
    settings.production.visual_sources = []
    monkeypatch.setattr("agent.context.RunContext.llm", FakeLLM())
    # 약 66초 분량 → 1.15배 이내로 속도 조정되어 60초 안에 들어와야 함
    sid = _approved(settings, _sample_script(settings, extra_chars=56))
    prod = produce(sid, settings=settings)
    assert prod.status == "produced", prod.error
    assert prod.duration <= 60
    # 너무 긴 대본은 failed + 축약 요청
    sid2 = _approved(settings, _sample_script(settings, extra_chars=400))
    prod2 = produce(sid2, settings=settings)
    assert prod2.status == "failed" and "축약" in prod2.error


def test_unapproved_script_refused(settings):
    sid = _approved(settings, {"title": "x", "scenes": [], "char_count": 0, "estimated_seconds": 0})
    with RunContext("2026-11-25", settings) as ctx:
        ctx.session.get(Script, sid).approval_status = "pending_review"
        ctx.session.commit()
    with pytest.raises(PermissionError):
        produce(sid, settings=settings)
    with RunContext("2026-11-25", settings) as ctx:
        assert ctx.session.query(Production).count() == 0


def test_word_dataclass():
    assert Word("a", 0, 1).end == 1
    assert np.isclose(1, 1)


def test_elevenlabs_auto_picks_voice_when_empty(monkeypatch, tmp_path):
    import httpx
    from agent import config as cfg
    from agent.production.tts.elevenlabs import ElevenLabsTTS
    monkeypatch.setenv("ELEVENLABS_API_KEY", "ek")
    monkeypatch.setattr(cfg, "LOCAL_SETTINGS", tmp_path / "local.yaml")

    def handler(req):
        assert req.url.path == "/v1/voices" and req.headers["xi-api-key"] == "ek"
        return httpx.Response(200, json={"voices": [
            {"voice_id": "v-en", "name": "Adam", "category": "premade", "labels": {"accent": "american"}},
            {"voice_id": "v-ko", "name": "지수", "category": "professional", "labels": {"language": "ko"}}]})
    tts = ElevenLabsTTS("", http=httpx.Client(transport=httpx.MockTransport(handler)))
    assert tts.voice_id == "v-en"   # 무료 플랜도 API 로 쓸 수 있는 기본(premade) 목소리 우선
    assert "v-en" in (tmp_path / "local.yaml").read_text(encoding="utf-8")


def test_elevenlabs_voice_list_failure_explains(monkeypatch):
    import httpx
    from agent.production.tts.elevenlabs import ElevenLabsTTS
    monkeypatch.setenv("ELEVENLABS_API_KEY", "ek")
    http = httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(401, json={})))
    with pytest.raises(RuntimeError, match="보이스 ID"):
        ElevenLabsTTS("", http=http)


def _mp3_bytes(tmp_path, secs=1.0):
    import subprocess
    p = tmp_path / "t.mp3"
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "lavfi", "-i", f"sine=d={secs}", str(p)], check=True)
    return p.read_bytes()


def test_elevenlabs_402_falls_back_to_premade_voice(monkeypatch, tmp_path):
    import base64
    import httpx
    from agent import config as cfg
    from agent.production.tts.elevenlabs import ElevenLabsTTS
    monkeypatch.setenv("ELEVENLABS_API_KEY", "ek")
    monkeypatch.setattr(cfg, "LOCAL_SETTINGS", tmp_path / "local.yaml")
    audio = base64.b64encode(_mp3_bytes(tmp_path)).decode()
    used = []

    def handler(req):
        if req.url.path == "/v1/voices":
            return httpx.Response(200, json={"voices": [{"voice_id": "lib", "category": "professional"},
                                                        {"voice_id": "pre", "category": "premade"}]})
        vid = req.url.path.split("/")[3]
        used.append(vid)
        if vid == "lib":
            return httpx.Response(402, json={"detail": {"status": "payment_required",
                                                        "message": "Free users cannot use library voices via the API"}})
        return httpx.Response(200, json={"audio_base64": audio, "alignment": {
            "characters": list("안녕"), "character_start_times_seconds": [0, .3],
            "character_end_times_seconds": [.3, .6]}})
    tts = ElevenLabsTTS("lib", http=httpx.Client(transport=httpx.MockTransport(handler)))
    res = tts.synthesize("안녕", tmp_path / "o.wav")
    assert used == ["lib", "pre"] and res.duration > 0.5 and res.words[0].text == "안녕"
    assert "pre" in (tmp_path / "local.yaml").read_text(encoding="utf-8")


def test_elevenlabs_402_no_credits_suggests_edge(monkeypatch, tmp_path):
    import httpx
    from agent.production.tts.elevenlabs import ElevenLabsTTS
    monkeypatch.setenv("ELEVENLABS_API_KEY", "ek")

    def handler(req):
        if req.url.path == "/v1/voices":
            return httpx.Response(200, json={"voices": [{"voice_id": "pre", "category": "premade"}]})
        return httpx.Response(402, json={"detail": {"message": "quota exceeded"}})
    tts = ElevenLabsTTS("pre", http=httpx.Client(transport=httpx.MockTransport(handler)))
    with pytest.raises(RuntimeError, match="Edge"):
        tts.synthesize("안녕", tmp_path / "o.wav")


def test_edge_tts_word_timestamps(monkeypatch, tmp_path):
    import edge_tts
    from agent.production.tts.base import get_provider
    data = _mp3_bytes(tmp_path, 1.5)
    seen = {}

    class FakeCommunicate:
        def __init__(self, text, voice, rate="+0%", boundary="SentenceBoundary"):
            seen.update(voice=voice, rate=rate, boundary=boundary)

        async def stream(self):
            yield {"type": "WordBoundary", "offset": 1_000_000, "duration": 4_000_000, "text": "안녕하세요"}
            yield {"type": "audio", "data": data}
            yield {"type": "WordBoundary", "offset": 6_000_000, "duration": 3_000_000, "text": "여러분"}
    monkeypatch.setattr(edge_tts, "Communicate", FakeCommunicate)
    tts = get_provider("edge", edge_voice="ko-KR-InJoonNeural")
    res = tts.synthesize("안녕하세요 여러분", tmp_path / "e.wav", speed=1.1)
    assert seen == {"voice": "ko-KR-InJoonNeural", "rate": "+10%", "boundary": "WordBoundary"}
    assert [(w.text, w.start, w.end) for w in res.words] == [("안녕하세요", 0.1, 0.5), ("여러분", 0.6, 0.9)]
    assert 1.3 < res.duration < 1.7
