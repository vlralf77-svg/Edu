"""TTS 어댑터 인터페이스. 모든 provider 는 WAV(44.1kHz mono) + 단어 타임스탬프를 돌려준다."""
from __future__ import annotations

import re
import subprocess
from dataclasses import dataclass, field
from pathlib import Path

import soundfile as sf


@dataclass
class Word:
    text: str
    start: float
    end: float


@dataclass
class TTSResult:
    audio_path: Path
    duration: float
    words: list[Word] = field(default_factory=list)
    chars: int = 0


class TTSProvider:
    name = "base"
    supports_speed = False

    def synthesize(self, text: str, out_path: Path, speed: float = 1.0) -> TTSResult:  # pragma: no cover
        raise NotImplementedError


def to_wav(src: Path, dst: Path, atempo: float = 1.0) -> None:
    af = ["-af", f"atempo={atempo:.3f}"] if abs(atempo - 1.0) > 1e-3 else []
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), *af, "-ac", "1", "-ar", "44100",
                    "-c:a", "pcm_s16le", str(dst)], check=True)


def wav_duration(path: Path) -> float:
    info = sf.info(str(path))
    return info.frames / info.samplerate


def proportional_words(text: str, duration: float, lead: float = 0.05) -> list[Word]:
    """타임스탬프를 주지 않는 provider 용: 글자 수 비례로 단어 시간 추정."""
    tokens = text.split()
    weights = [len(re.sub(r"\W", "", t)) + 1 for t in tokens]
    total = sum(weights) or 1
    span = max(duration - 2 * lead, 0.1)
    t, out = lead, []
    for tok, w in zip(tokens, weights):
        d = span * w / total
        out.append(Word(tok, round(t, 3), round(t + d, 3)))
        t += d
    return out


def chars_to_words(chars: list[str], starts: list[float], ends: list[float]) -> list[Word]:
    """문자 단위 정렬(ElevenLabs alignment) → 공백 기준 단어 타임스탬프."""
    words, buf, ws, we = [], "", None, 0.0
    for c, s, e in zip(chars, starts, ends):
        if c.isspace():
            if buf:
                words.append(Word(buf, ws, we))
            buf, ws = "", None
            continue
        if ws is None:
            ws = s
        buf += c
        we = e
    if buf:
        words.append(Word(buf, ws, we))
    return words


def get_provider(name: str, voice_id: str = "", **kw) -> TTSProvider:
    if name == "elevenlabs":
        from .elevenlabs import ElevenLabsTTS
        return ElevenLabsTTS(voice_id=voice_id, **kw)
    if name == "google":
        from .google import GoogleTTS
        return GoogleTTS(voice_id=voice_id)
    if name == "edge":
        from .edge import EdgeTTS
        return EdgeTTS(kw.get("edge_voice", ""))
    if name == "dummy":
        from .dummy import DummyTTS
        return DummyTTS(**{k: v for k, v in kw.items() if k == "chars_per_second"})
    raise ValueError(f"알 수 없는 TTS provider: {name}")
