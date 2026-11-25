"""Step 7. 승인된 대본 1개 → final.mp4 + meta.json."""
from __future__ import annotations

import json
import logging
import shutil
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import soundfile as sf
from sqlalchemy import select

from ..models import BgmSeed, Production, Script
from ..notify import notify
from . import composer
from .bgm import generator, library
from .bgm.mood import analyze_mood
from .fonts import find_font, family_name
from .subtitles import build_cues, write_ass, write_srt
from .tts.base import TTSResult, Word, get_provider, to_wav, wav_duration
from .visuals import VisualFetcher, title_overlay

log = logging.getLogger(__name__)
SCENE_GAP = 0.25   # 장면 사이 숨 고르기
TAIL = 0.6         # 마지막 장면 뒤 여운


class ScriptTooLong(RuntimeError):
    pass


def _speed_adjust(results: list[TTSResult], speed: float, tmp_dir: Path) -> list[TTSResult]:
    """provider 가 속도 조절을 못 하면 atempo 로 후처리 (단어 타임스탬프도 같이 스케일)."""
    out = []
    for r in results:
        dst = tmp_dir / (r.audio_path.stem + "_fast.wav")
        to_wav(r.audio_path, dst, atempo=speed)
        out.append(TTSResult(dst, wav_duration(dst), [Word(w.text, w.start / speed, w.end / speed) for w in r.words],
                             r.chars))
    return out


def synthesize_scenes(ctx, scenes: list[dict], out_dir: Path, tts=None) -> list[TTSResult]:
    p = ctx.settings.production
    budget = ctx.settings.script.max_seconds
    tts = tts or get_provider(p.tts_provider, p.voice_id, model_id=p.elevenlabs_model, edge_voice=p.edge_voice,
                              chars_per_second=ctx.settings.script.chars_per_second)

    def run(speed: float) -> list[TTSResult]:
        res = []
        for sc in scenes:
            r = tts.synthesize(sc["narration"], out_dir / f"tts_{sc['idx']:02d}.wav", speed=speed)
            ctx.tracker.add(f"tts_chars:{tts.name}", r.chars)
            res.append(r)
        return res

    def total(rs):
        return sum(r.duration for r in rs) + SCENE_GAP * (len(rs) - 1) + TAIL

    results = run(1.0)
    t = total(results)
    if t > budget:
        need = t / (budget - 0.3)
        if need > p.max_tts_speed:
            raise ScriptTooLong(f"내레이션 {t:.1f}s — 말속도 {need:.2f}배가 필요해 상한({p.max_tts_speed})을 넘습니다. 대본 축약 필요")
        log.info("내레이션 %.1fs > %ds → 말속도 %.2f배", t, budget, need)
        results = run(need) if tts.supports_speed and tts.name != "dummy" else _speed_adjust(results, need, out_dir)
        if total(results) > budget:  # provider 가 요청 속도를 정확히 못 맞춘 경우 한 번 더 후처리
            results = _speed_adjust(results, total(results) / (budget - 0.3), out_dir)
    return results


def build_narration(results: list[TTSResult], out: Path) -> tuple[list[float], list[float], list[Word], float]:
    """장면 음성을 이어 붙이고 장면 시작/길이, 전체 단어 타임라인을 돌려준다."""
    chunks, starts, durs, words = [], [], [], []
    t = 0.0
    for i, r in enumerate(results):
        audio, sr = sf.read(str(r.audio_path), dtype="float32")
        if audio.ndim > 1:
            audio = audio.mean(axis=1)
        pad = TAIL if i == len(results) - 1 else SCENE_GAP
        seg = np.concatenate([audio, np.zeros(int(pad * sr), dtype=np.float32)])
        starts.append(t)
        durs.append(len(seg) / sr)
        words += [Word(w.text, w.start + t, w.end + t) for w in r.words]
        chunks.append(seg)
        t += len(seg) / sr
    sf.write(str(out), np.concatenate(chunks), 44100, subtype="PCM_16")
    return starts, durs, words, t


def recent_bgm_keys(session, days: int) -> set[str]:
    since = datetime.now(timezone.utc) - timedelta(days=days)
    return {r.key for r in session.scalars(select(BgmSeed).where(BgmSeed.used_at >= since))}


def make_bgm(ctx, script: dict, duration: float, out_dir: Path) -> tuple[Path | None, dict]:
    b = ctx.settings.bgm
    try:
        llm = ctx.llm
    except Exception as e:  # API 키 없음 등 → 키워드 휴리스틱으로 대체
        log.warning("LLM 사용 불가(%s) → mood 휴리스틱", e)
        llm = None
    mood = analyze_mood(llm, script)
    (out_dir / "mood.json").write_text(json.dumps(mood, ensure_ascii=False, indent=2), encoding="utf-8")
    if mood["mood"] == "sad" and b.sad_disable:
        return None, {"type": "none", "reason": "sad 주제 — 설정에 따라 BGM 없음", "mood": mood}
    used = recent_bgm_keys(ctx.session, b.avoid_repeat_days)
    path, meta = None, {}
    if b.mode in ("library", "hybrid"):
        tracks, _rej = library.scan(ctx.settings.resolve(b.library_dir))
        tr = library.choose(tracks, mood["mood"], mood["tempo_bpm"], {k[6:] for k in used if k.startswith("track:")})
        if tr:
            path, meta = library.prepare(tr, duration, out_dir, b.fade_in_sec, b.fade_out_sec)
            ctx.session.add(BgmSeed(key=f"track:{tr.path}"))
        elif b.mode == "library":
            log.warning("라이브러리에 %s 분위기 곡이 없어 BGM 없이 진행", mood["mood"])
            return None, {"type": "none", "reason": "라이브러리에 맞는 곡 없음", "mood": mood}
    if path is None:
        seed = generator.seed_for(ctx.run_date, script.get("topic_id", ""))
        while f"seed:{seed}" in used:  # 같은 시드 재사용 금지
            seed = (seed + 7919) % 2**32
        path, meta = generator.generate_bgm(
            mood["mood"], duration, seed, out_dir, ctx.settings.resolve(b.soundfont), tempo_bpm=mood["tempo_bpm"],
            key=mood.get("key", ""), energy=mood.get("energy"), fade_in=b.fade_in_sec, fade_out=b.fade_out_sec)
        ctx.session.add(BgmSeed(key=f"seed:{seed}"))
    meta["mood_analysis"] = mood
    return path, meta


def build_description(script: dict, visuals: list[dict], bgm_meta: dict) -> str:
    lines = [script.get("title", ""), ""]
    lines += ["📚 출처"] + [f"- {u}" for u in script.get("sources", [])]
    credits = []
    for v in visuals:
        if v.get("source") == "wikimedia_commons":  # CC BY/BY-SA 는 저작자·라이선스 표기 의무
            c = f"\"{v.get('title', '').removeprefix('File:')}\" by {v.get('author')}, {v.get('license')}, via Wikimedia Commons {v.get('page', '')}"
        elif v.get("source") in ("pexels", "pixabay"):
            c = f"{v['source'].capitalize()} — {v.get('author', '')} {v.get('page', '')}"
        else:
            continue
        if c.strip() not in credits:
            credits.append(c.strip())
    if credits:
        lines += ["", "🎞 영상·이미지 출처"] + [f"- {c}" for c in credits]
    if bgm_meta.get("type") == "library" and bgm_meta.get("attribution"):
        lines += ["", f"🎵 음악: {bgm_meta['attribution']}"]
    lines += ["", "※ 이 영상은 AI 도구(대본 작성·음성 합성)를 활용해 제작되었습니다.", "", " ".join(script.get("hashtags", []))]
    return "\n".join(lines)


def produce_script(ctx, script_row: Script, tts=None, stock_search=None) -> Production:
    s = ctx.settings
    p = s.production
    size = tuple(p.resolution)
    prod = Production(script_id=script_row.id, status="producing")
    ctx.session.add(prod)
    ctx.session.commit()
    out_dir = ctx.run_dir / "production" / f"script_{script_row.id}"
    work = out_dir / "work"
    work.mkdir(parents=True, exist_ok=True)
    script = script_row.json
    scenes = script["scenes"]
    try:
        # 1) TTS
        results = synthesize_scenes(ctx, scenes, work, tts)
        narration = work / "narration.wav"
        starts, durs, words, total = build_narration(results, narration)
        # 2) 비주얼 + 상단 타이틀
        visuals, clips = [], []
        fetcher = VisualFetcher(p.visual_sources, size, p.font_path, clients=stock_search,
                                max_per_subject=p.commons_max_per_subject, max_clip_mb=p.max_clip_mb)
        for sc, dur in zip(scenes, durs):
            ov = work / f"title_{sc['idx']:02d}.png"
            vis = fetcher.fetch(sc, work / f"scene_{sc['idx']:02d}", dur)
            visuals.append(vis)
            # 타이포그래피 카드는 화면 텍스트를 이미 크게 보여주므로 상단 타이틀 생략
            title_overlay("" if vis.get("kind") == "card" else sc.get("on_screen_text", ""), size, ov,
                          p.font_path)
            clip = work / f"clip_{sc['idx']:02d}.mp4"
            composer.render_scene(Path(vis["path"]), ov, dur, clip, sc["idx"], size, p.fps, kind=vis["kind"])
            clips.append(clip)
        video_only = work / "video_only.mp4"
        composer.concat_videos(clips, video_only)
        # 3) 자막
        cues = build_cues(words, p.subtitle_max_chars)
        write_srt(cues, out_dir / "subtitles.srt")
        ass = None
        if p.burn_subtitles:
            ass = work / "subtitles.ass"
            write_ass(cues, ass, family_name(p.font_path), size)
        # 4) BGM
        bgm_path, bgm_meta = make_bgm(ctx, script, total, work)
        if bgm_path:
            shutil.copy(bgm_path, out_dir / "bgm.wav")
            shutil.copy(work / "bgm_meta.json", out_dir / "bgm_meta.json")
        mood = bgm_meta.get("mood_analysis", bgm_meta.get("mood", {})) or {}
        volume = s.bgm.sad_volume if mood.get("mood") == "sad" else s.bgm.volume
        segs = composer.speech_segments([(w.start, w.end) for w in words])
        mix = work / "mix.wav"
        mix_info = composer.mix_audio(narration, bgm_path, segs, mix, total, volume, s.bgm.ducking_db)
        # 5) 최종 합성
        final = out_dir / "final.mp4"
        font_file, _ = find_font(p.font_path)
        composer.finalize(video_only, mix, final, total, ass, font_file.parent, p.fps)
        # 6) 메타
        meta = {
            "title": script.get("title", ""),
            "description": build_description(script, visuals, bgm_meta),
            "hashtags": script.get("hashtags", []),
            "sources": script.get("sources", []),
            "visuals": visuals,
            "bgm": bgm_meta,
            "mix": mix_info,
            "synthetic_media": True,   # YouTube '변경되거나 합성된 콘텐츠' 공개
            "made_for_kids": False,
            "script_id": script_row.id,
        }
        (out_dir / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
        # 7) 검증
        info = composer.probe(final)
        errs = composer.validate(info, s.script.max_seconds, size)
        if errs:
            raise RuntimeError("산출물 검증 실패: " + "; ".join(errs))
        prod.status, prod.video_path, prod.duration = "produced", str(final), info["duration"]
        script_row.approval_status = "produced"
        log.info("제작 완료: %s (%.1fs) → %s", script.get("title"), info["duration"], final)
        notify(f"🎬 제작 완료: {script.get('title')} ({info['duration']:.0f}초)\n{final}", s.notify.enabled)
    except Exception as e:
        from ..costs import BudgetExceeded
        log.exception("제작 실패: script %d", script_row.id)
        prod.status, prod.error = "failed", f"{type(e).__name__}: {e}"
        ctx.save()
        if isinstance(e, BudgetExceeded):
            raise
        notify(f"⚠️ 제작 실패: {script.get('title')} — {e}", s.notify.enabled)
        return prod
    ctx.save()
    return prod
