"""로컬 무료 음원 라이브러리 (사람이 라이선스를 확인하고 넣은 곡만).

곡마다 license.json 필수: `track.mp3` + `track.license.json` 또는 `폴더/track.mp3` + `폴더/license.json`.
라이선스 파일이 없거나 비상업(NC)·변경금지(ND) 계열이면 로딩을 거부한다. 인터넷에서 자동 다운로드하지 않는다.
"""
from __future__ import annotations

import json
import logging
import re
import subprocess
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import soundfile as sf

from .generator import SR, master

log = logging.getLogger(__name__)
AUDIO_EXT = {".mp3", ".wav", ".ogg", ".m4a", ".flac"}
FORBIDDEN = re.compile(r"(비상업|상업적\s*이용\s*불가|non[-\s]?commercial|\bNC\b|-NC|NC-|변경\s*금지|no[-\s]?deriv|\bND\b|-ND)",
                       re.I)


class LicenseError(ValueError):
    pass


@dataclass
class Track:
    path: Path
    title: str
    license: str
    source: str
    attribution: str = ""
    moods: list[str] = field(default_factory=list)
    bpm: int | None = None


def license_file(audio: Path) -> Path | None:
    own = audio.with_suffix(".license.json")
    if own.exists():
        return own
    # 폴더 단위 license.json 은 그 폴더에 곡이 하나뿐일 때만 인정 (곡마다 라이선스 확인 원칙)
    shared = audio.parent / "license.json"
    siblings = [p for p in audio.parent.iterdir() if p.suffix.lower() in AUDIO_EXT]
    if shared.exists() and len(siblings) == 1:
        return shared
    return None


def load_track(audio: Path) -> Track:
    lf = license_file(audio)
    if lf is None:
        raise LicenseError(f"license.json 없음: {audio.name}")
    try:
        info = json.loads(lf.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise LicenseError(f"license.json 파싱 실패: {lf}") from e
    lic = str(info.get("license", "")).strip()
    if not lic:
        raise LicenseError(f"license 항목 비어 있음: {lf}")
    if FORBIDDEN.search(lic):
        raise LicenseError(f"허용되지 않는 라이선스({lic}): {audio.name}")
    return Track(path=audio, title=info.get("title", audio.stem), license=lic, source=info.get("source", ""),
                 attribution=info.get("attribution", ""), moods=list(info.get("mood", [])), bpm=info.get("bpm"))


def scan(library_dir: Path) -> tuple[list[Track], list[tuple[Path, str]]]:
    ok, rejected = [], []
    if not library_dir.exists():
        return ok, rejected
    for p in sorted(library_dir.rglob("*")):
        if p.suffix.lower() not in AUDIO_EXT:
            continue
        try:
            ok.append(load_track(p))
        except LicenseError as e:
            log.warning("라이브러리 곡 거부: %s", e)
            rejected.append((p, str(e)))
    return ok, rejected


def choose(tracks: list[Track], mood: str, bpm: int | None, recently_used: set[str]) -> Track | None:
    cands = [t for t in tracks if mood in t.moods and str(t.path) not in recently_used]
    if not cands:
        return None
    return min(cands, key=lambda t: abs((t.bpm or bpm or 100) - (bpm or 100)))


def prepare(track: Track, duration: float, out_dir: Path, fade_in: float, fade_out: float) -> tuple[Path, dict]:
    out_dir.mkdir(parents=True, exist_ok=True)
    tmp = out_dir / "bgm_lib_decoded.wav"
    from ...tools import tool
    subprocess.run([tool("ffmpeg"), "-y", "-loglevel", "error", "-i", str(track.path), "-ac", "2", "-ar", str(SR),
                    str(tmp)], check=True)
    audio, _ = sf.read(str(tmp), dtype="float32", always_2d=True)
    tmp.unlink(missing_ok=True)
    length = duration + 0.5
    reps = int(np.ceil(length * SR / max(len(audio), 1)))
    audio = master(np.tile(audio, (reps, 1)), length, fade_in, fade_out)
    out = out_dir / "bgm.wav"
    sf.write(str(out), audio, SR, subtype="PCM_16")
    meta = {"type": "library", "title": track.title, "file": track.path.name, "license": track.license,
            "source": track.source, "attribution": track.attribution, "length_sec": round(length, 3)}
    (out_dir / "bgm_meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    return out, meta
