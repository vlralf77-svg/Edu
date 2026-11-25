"""절차적 작곡: 분위기 프리셋 + 시드 → MIDI(pretty_midi) → fluidsynth 렌더 → 노멀라이즈/페이드 WAV.

남이 만든 곡을 가져오지 않고 매번 새로 작곡한다. bgm_meta.json 이 '직접 생성한 음악' 증빙이다.
"""
from __future__ import annotations

import hashlib
import json
import logging
import math
import random
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pretty_midi
import soundfile as sf

from .mood import presets

log = logging.getLogger(__name__)

SR = 44100
SCALES = {"major": [0, 2, 4, 5, 7, 9, 11], "minor": [0, 2, 3, 5, 7, 8, 10], "dorian": [0, 2, 3, 5, 7, 9, 10]}
NOTE_PC = {"C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5, "F#": 6, "Gb": 6, "G": 7,
           "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11}
ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"]
SOUNDFONT_FALLBACKS = ["/usr/share/sounds/sf2/FluidR3_GM.sf2", "/usr/share/soundfonts/FluidR3_GM.sf2"]
SOUNDFONT_LICENSE = {"FluidR3_GM.sf2": "MIT License (Frank Wen, FluidR3 GM soundfont)"}

# GM 드럼 노트
KICK, SIDE, SNARE, CLAP, HAT, CRASH, SHAKER = 36, 37, 38, 39, 42, 49, 70


def seed_for(run_date: str, topic_id: str) -> int:
    return int(hashlib.sha256(f"{run_date}:{topic_id}".encode()).hexdigest()[:8], 16)


def parse_key(key: str, modes: list[str], rng: random.Random) -> tuple[int, str, str]:
    """'D minor' → (tonic pc, mode, 표기). 프리셋이 허용하지 않는 조성이면 프리셋 기본 모드를 쓴다."""
    parts = (key or "").replace("♯", "#").replace("♭", "b").split()
    tonic = NOTE_PC.get(parts[0][:2], NOTE_PC.get(parts[0][:1])) if parts else None
    mode = parts[1].lower() if len(parts) > 1 else ""
    if tonic is None:
        tonic = rng.choice([0, 2, 4, 5, 7, 9])
    if mode not in modes:
        mode = rng.choice(modes)
    name = [k for k, v in NOTE_PC.items() if v == tonic][0]
    return tonic, mode, f"{name} {mode}"


def _chord(scale: list[int], tonic: int, degree: int, octave: int) -> list[int]:
    notes = []
    for step in (0, 2, 4):
        i = degree + step
        notes.append(12 * (octave + 1) + tonic + scale[i % 7] + 12 * (i // 7))
    return notes


def compose(mood: str, duration: float, seed: int, tempo_bpm: int | None = None, key: str = "",
            energy: float | None = None, hook_impact: bool = True) -> tuple[pretty_midi.PrettyMIDI, dict]:
    p = presets()[mood]
    rng = random.Random(seed)
    lo, hi = p["tempo"]
    bpm = int(min(max(tempo_bpm or rng.randint(lo, hi), lo), hi))
    energy = p["energy"] if energy is None else energy
    tonic, mode, key_name = parse_key(key, p["modes"], rng)
    scale = SCALES[mode]
    prog = rng.choice(p["progressions"])
    if rng.random() < 0.3:  # 시드 기반 변형: 진행 회전
        r = rng.randrange(len(prog))
        prog = prog[r:] + prog[:r]

    beat = 60 / bpm
    bar = 4 * beat
    n_bars = math.ceil((duration + 0.5) / bar) + 1
    pm = pretty_midi.PrettyMIDI(initial_tempo=bpm)
    inst = p["instruments"]
    vel = lambda base: int(max(20, min(110, base * (0.6 + 0.6 * energy) + rng.randint(-4, 4))))  # noqa: E731

    tracks: dict[str, pretty_midi.Instrument] = {}
    for role in ("pad", "bass", "arp", "melody", "perc"):
        if inst.get(role) is not None:
            tracks[role] = pretty_midi.Instrument(program=int(inst[role]), name=role)
    drums = pretty_midi.Instrument(program=0, is_drum=True, name="drums")

    def add(role: str, pitch: int, start: float, length: float, v: int):
        if role in tracks:
            tracks[role].notes.append(pretty_midi.Note(velocity=v, pitch=pitch, start=start, end=start + length))

    def hit(pitch: int, start: float, v: int):
        drums.notes.append(pretty_midi.Note(velocity=v, pitch=pitch, start=start, end=start + 0.1))

    arp_shape = rng.choice(["up", "down", "updown", "random"])
    hat_density = rng.choice([2, 2, 4]) if p["drums"] in ("full", "kick") else 2
    melody_pitch = 12 * 7 + tonic + scale[rng.randrange(7)]  # C6 근처: 내레이션 중음역 회피

    for b in range(n_bars):
        t0 = b * bar
        is_intro, is_end = b == 0, b == n_bars - 1
        degree = 0 if is_end else prog[(b - 1) % len(prog)] if b > 0 else prog[0]
        pad_notes = _chord(scale, tonic, degree, 4)
        # 패드: 마디 전체 지속 (낮은 음량)
        for n in pad_notes:
            add("pad", n, t0, bar * (2 if is_end else 1), vel(48))
        # 베이스
        root = _chord(scale, tonic, degree, 2)[0]
        bp = p["bass_pattern"]
        if not is_intro and bp != "none":
            if is_end or bp == "wholes":
                add("bass", root, t0, bar * (2 if is_end else 1), vel(70))
            elif bp == "halves":
                for k in range(2):
                    add("bass", root, t0 + k * 2 * beat, 2 * beat * 0.95, vel(70))
            elif bp == "eighths":
                for k in range(8):
                    add("bass", root + (12 if k % 4 == 3 and rng.random() < 0.5 else 0), t0 + k * beat / 2,
                        beat / 2 * 0.8, vel(72))
            elif bp == "pulse":
                for k in range(16):
                    add("bass", root, t0 + k * beat / 4, beat / 4 * 0.6, vel(60 + (12 if k % 4 == 0 else 0)))
            elif bp == "bounce":
                fifth = _chord(scale, tonic, degree, 2)[2]
                for k in range(4):
                    add("bass", root if k % 2 == 0 else fifth, t0 + k * beat, beat * 0.5, vel(72))
        # 아르페지오 (고음역)
        if not is_end and "arp" in tracks:
            rate = p["arp_rate"]
            tones = _chord(scale, tonic, degree, 5)
            seq = {"up": tones, "down": tones[::-1], "updown": tones + tones[-2:0:-1]}.get(arp_shape)
            step = bar / rate
            for k in range(rate):
                n = rng.choice(tones) if seq is None else seq[k % len(seq)]
                add("arp", n, t0 + k * step, step * 0.9, vel(55 + (8 if k % 4 == 0 else 0)))
        # 멜로디 (선택, 아주 작게)
        if not is_intro and not is_end and "melody" in tracks and b % 2 == 0:
            for k in range(rng.choice([4, 6, 8])):
                melody_pitch += rng.choice([-2, -1, 0, 1, 2])
                pcs = [(tonic + s) % 12 for s in scale]
                while melody_pitch % 12 not in pcs:
                    melody_pitch += 1
                melody_pitch = min(max(melody_pitch, 84), 98)
                add("melody", melody_pitch, t0 + k * bar / 4, bar / 4 * 0.9, vel(42))
        # 팀파니 (inspiring)
        if p.get("timpani") and not is_intro and b % 2 == 1:
            add("perc", 12 * 3 + tonic, t0, beat, vel(80))
        # 드럼: 인트로(첫 마디)·엔딩은 없음
        style = p["drums"]
        if style != "none" and not is_intro and not is_end:
            for s16 in range(16):
                t = t0 + s16 * beat / 4
                if style == "full":
                    if s16 in (0, 8) or (s16 in (10, 14) and rng.random() < 0.25):
                        hit(KICK, t, vel(90))
                    if s16 in (4, 12):
                        hit(SNARE, t, vel(80))
                    if s16 % hat_density == 0:
                        hit(HAT, t, vel(50))
                elif style == "light":
                    if s16 == 0:
                        hit(KICK, t, vel(70))
                    if s16 in (4, 12):
                        hit(SIDE, t, vel(55))
                    if s16 % 4 == 2:
                        hit(SHAKER, t, vel(40))
                elif style == "kick":
                    if s16 % 4 == 0:
                        hit(KICK, t, vel(95))
                    if s16 % 4 == 2 and rng.random() < 0.7:
                        hit(HAT, t, vel(40))
                elif style == "electro":
                    if s16 % 4 == 0:
                        hit(KICK, t, vel(95))
                    if s16 in (4, 12):
                        hit(CLAP, t, vel(75))
                    hit(HAT, t, vel(38 + (14 if s16 % 2 == 0 else 0) + rng.randint(0, 6)))
                elif style == "soft":
                    if s16 in (0, 10):
                        hit(KICK, t, vel(55))
                    if s16 % 2 == 0:
                        hit(SHAKER, t, vel(30))

    # Hook 구간(0~3초) 임팩트 1회: 인트로가 끝나는 지점이 3초 안이면 거기, 아니면 0초
    impact_at = None
    if hook_impact and mood != "sad":
        impact_at = bar if bar <= 3.0 else 0.0
        if p["drums"] == "none" and "perc" in tracks:
            add("perc", 12 * 3 + tonic, impact_at, beat * 2, vel(100))
        else:
            hit(CRASH, impact_at, vel(85))

    for tr in tracks.values():
        pm.instruments.append(tr)
    if drums.notes:
        pm.instruments.append(drums)

    def numeral(d: int) -> str:  # 화음 성질(장3도=대문자, 단3도=소문자)로 표기
        c = _chord(scale, 0, d, 4)
        return ROMAN[d] if (c[1] - c[0]) == 4 else ROMAN[d].lower()

    roman = [numeral(d) for d in prog]
    meta = {"mood": mood, "bpm": bpm, "key": key_name, "mode": mode, "progression": "–".join(roman),
            "seed": seed, "bars": n_bars, "energy": round(energy, 2), "arp_shape": arp_shape,
            "hook_impact_sec": impact_at,
            "instruments": {r: int(t.program) for r, t in tracks.items()}, "drums": p["drums"]}
    return pm, meta


def find_soundfont(path: Path) -> Path:
    if path.exists():
        return path
    for fb in SOUNDFONT_FALLBACKS:
        if Path(fb).exists():
            return Path(fb)
    raise RuntimeError(f"사운드폰트 없음: {path} (apt install fluid-soundfont-gm 또는 파일 복사)")


def render(pm: pretty_midi.PrettyMIDI, soundfont: Path, out_wav: Path) -> None:
    if not shutil.which("fluidsynth"):
        raise RuntimeError("fluidsynth 미설치 (apt install fluidsynth)")
    mid = out_wav.with_suffix(".mid")
    pm.write(str(mid))
    subprocess.run(["fluidsynth", "-ni", "-q", "-g", "0.6", "-r", str(SR), "-F", str(out_wav), str(soundfont),
                    str(mid)], check=True, capture_output=True)


def master(audio: np.ndarray, length: float, fade_in: float, fade_out: float,
           target_dbfs: float = -16.0) -> np.ndarray:
    """정확한 길이로 자르기/패딩 → RMS 기준 노멀라이즈(-16 LUFS 근사) → 피크 -1 dBFS 제한 → 페이드."""
    if audio.ndim == 1:
        audio = np.stack([audio, audio], axis=1)
    n = int(round(length * SR))
    audio = audio[:n] if len(audio) >= n else np.pad(audio, ((0, n - len(audio)), (0, 0)))
    rms = float(np.sqrt(np.mean(audio ** 2))) or 1e-9
    audio = audio * (10 ** (target_dbfs / 20) / rms)
    peak = float(np.max(np.abs(audio))) or 1e-9
    ceiling = 10 ** (-1 / 20)
    if peak > ceiling:
        audio = audio * (ceiling / peak)
    fi, fo = int(fade_in * SR), int(fade_out * SR)
    if fi:
        audio[:fi] *= np.linspace(0, 1, fi)[:, None]
    if fo:
        audio[-fo:] *= np.linspace(1, 0, fo)[:, None]
    return audio.astype(np.float32)


def generate_bgm(mood: str, duration: float, seed: int, out_dir: Path, soundfont: Path, *, tempo_bpm=None, key="",
                 energy=None, fade_in: float = 0.5, fade_out: float = 1.5) -> tuple[Path, dict]:
    """영상 길이 + 0.5초 길이의 bgm.wav 와 bgm_meta.json 생성."""
    out_dir.mkdir(parents=True, exist_ok=True)
    sf_path = find_soundfont(soundfont)
    length = duration + 0.5
    pm, meta = compose(mood, duration, seed, tempo_bpm, key, energy)
    raw = out_dir / "bgm_raw.wav"
    render(pm, sf_path, raw)
    audio, sr = sf.read(str(raw), dtype="float32", always_2d=True)
    assert sr == SR, sr
    audio = master(audio, length, fade_in, fade_out)
    out = out_dir / "bgm.wav"
    sf.write(str(out), audio, SR, subtype="PCM_16")
    raw.unlink(missing_ok=True)
    meta.update({
        "type": "generated", "length_sec": round(length, 3), "sample_rate": SR,
        "soundfont": sf_path.name, "soundfont_license": SOUNDFONT_LICENSE.get(sf_path.name, "확인 필요"),
        "generator": "trend-shorts-agent procedural composer (pretty_midi + fluidsynth)",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "statement": "이 배경음악은 본 프로그램이 시드 기반으로 직접 작곡·렌더링한 것으로 외부 음원을 사용하지 않았습니다.",
    })
    (out_dir / "bgm_meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    log.info("BGM 생성: %s %dbpm %s %s seed=%d (%.1fs)", mood, meta["bpm"], meta["key"], meta["progression"], seed,
             length)
    return out, meta
