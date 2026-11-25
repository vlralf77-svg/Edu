"""오프라인 테스트용 TTS: 글자 수 비례 길이의 '말소리 비슷한' 신호(단어마다 톤 버스트)를 만든다."""
from __future__ import annotations

import re
from pathlib import Path

import numpy as np
import soundfile as sf

from .base import TTSProvider, TTSResult, proportional_words

SR = 44100


class DummyTTS(TTSProvider):
    name = "dummy"
    supports_speed = True

    def __init__(self, chars_per_second: float = 5.2):
        self.cps = chars_per_second

    def synthesize(self, text: str, out_path: Path, speed: float = 1.0) -> TTSResult:
        n = len(re.sub(r"\s+", "", text))
        dur = max(n / (self.cps * speed), 0.5) + 0.1
        words = proportional_words(text, dur)
        audio = np.zeros(int(dur * SR), dtype=np.float32)
        rng = np.random.default_rng(len(text))
        for w in words:
            a, b = int(w.start * SR), int((w.end - 0.04) * SR)
            if b <= a:
                continue
            t = np.arange(b - a) / SR
            f0 = 140 + 40 * rng.random()
            sig = 0.3 * np.sin(2 * np.pi * f0 * t) + 0.15 * np.sin(2 * np.pi * 2 * f0 * t)
            env = np.minimum(1, np.minimum(t, t[::-1]) / 0.02)
            audio[a:b] += (sig * env).astype(np.float32)
        sf.write(str(out_path), audio, SR, subtype="PCM_16")
        return TTSResult(out_path, len(audio) / SR, words, chars=len(text))
