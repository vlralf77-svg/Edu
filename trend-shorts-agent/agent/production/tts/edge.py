"""Microsoft Edge 읽어주기 음성 (edge-tts, 무료·키 불필요). 단어 타임스탬프로 자막 싱크.

⚠️ 공식 유료 API 가 아니라 Edge 브라우저의 읽어주기 서비스를 이용하는 비공식 방식입니다.
   서비스가 예고 없이 막히거나 바뀔 수 있고, 상업적 이용 조건이 명확하지 않습니다.
   수익화 채널이라면 유료 TTS(ElevenLabs Starter, Google Cloud TTS 등)로 바꾸는 것을 권장합니다.
"""
from __future__ import annotations

import asyncio
import re
from pathlib import Path

from .base import TTSProvider, TTSResult, Word, proportional_words, to_wav, wav_duration

KOREAN_VOICES = {
    "ko-KR-SunHiNeural": "선히 (여성, 밝은 뉴스톤)",
    "ko-KR-InJoonNeural": "인준 (남성, 차분한 뉴스톤)",
    "ko-KR-HyunsuMultilingualNeural": "현수 (남성, 자연스러운 대화톤)",
}


def _auto_install(pkg: str) -> None:
    """구버전 설치본에 부품이 없으면 자동 설치 (uv 사용, 없으면 pip)."""
    import importlib
    import logging
    import os
    import shutil
    import subprocess
    import sys
    logging.getLogger(__name__).warning("필요한 부품 '%s' 을 설치합니다 (처음 한 번)...", pkg)
    uv = shutil.which("uv") or next((p for p in (
        os.path.expanduser("~/.local/bin/uv.exe"), os.path.expanduser("~/.local/bin/uv")) if os.path.exists(p)), None)
    cmd = [uv, "pip", "install", "--python", sys.executable, pkg] if uv else [sys.executable, "-m", "pip", "install", pkg]
    r = subprocess.run(cmd, capture_output=True, text=True)
    importlib.invalidate_caches()
    if r.returncode != 0:
        raise RuntimeError(f"'{pkg}' 자동 설치 실패 — 설치 프로그램(install_windows.bat)을 다시 실행하세요.\n{r.stderr[-500:]}")


class EdgeTTS(TTSProvider):
    name = "edge"
    supports_speed = True

    def __init__(self, voice: str = "ko-KR-SunHiNeural"):
        try:
            import edge_tts  # noqa: F401
        except ImportError:
            _auto_install("edge-tts")
        self.voice = voice or "ko-KR-SunHiNeural"

    async def _run(self, text: str, speed: float) -> tuple[bytes, list[Word]]:
        import edge_tts
        rate = f"{round((speed - 1) * 100):+d}%"
        com = edge_tts.Communicate(text, self.voice, rate=rate, boundary="WordBoundary")
        audio, words = bytearray(), []
        async for chunk in com.stream():
            if chunk["type"] == "audio":
                audio += chunk["data"]
            elif chunk["type"] == "WordBoundary":
                start = chunk["offset"] / 1e7  # 100ns 단위
                words.append(Word(chunk["text"], round(start, 3), round(start + chunk["duration"] / 1e7, 3)))
        return bytes(audio), words

    def synthesize(self, text: str, out_path: Path, speed: float = 1.0) -> TTSResult:
        try:
            data, words = asyncio.run(self._run(text, speed))
        except Exception as e:  # noqa: BLE001
            raise RuntimeError(f"Edge 음성 생성 실패 (인터넷 연결 확인): {e}") from e
        if not data:
            raise RuntimeError("Edge 음성 생성 결과가 비어 있습니다")
        mp3 = out_path.with_suffix(".mp3")
        mp3.write_bytes(data)
        to_wav(mp3, out_path)
        dur = wav_duration(out_path)
        words = [w for w in words if re.sub(r"\W", "", w.text)] or proportional_words(text, dur)
        return TTSResult(out_path, dur, words, chars=len(text))
