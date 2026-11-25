"""ElevenLabs TTS (with-timestamps 엔드포인트 → 문자 단위 정렬로 자막 싱크)."""
from __future__ import annotations

import base64
from pathlib import Path

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from ...config import env
from .base import TTSProvider, TTSResult, chars_to_words, to_wav, wav_duration

API = "https://api.elevenlabs.io/v1/text-to-speech/{voice}/with-timestamps"


class ElevenLabsTTS(TTSProvider):
    name = "elevenlabs"
    supports_speed = True

    def __init__(self, voice_id: str = "", model_id: str = "eleven_multilingual_v2", http: httpx.Client | None = None,
                 **_):
        self.key = env("ELEVENLABS_API_KEY")
        if not self.key:
            raise RuntimeError("ELEVENLABS_API_KEY 가 설정되지 않았습니다 (.env)")
        if not voice_id:
            raise RuntimeError("production.voice_id 를 settings.yaml 에 설정하세요 (ElevenLabs 보이스 ID)")
        self.voice_id, self.model_id = voice_id, model_id
        self.http = http or httpx.Client(timeout=120)

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=2, max=20), reraise=True)
    def _request(self, text: str, speed: float) -> dict:
        r = self.http.post(
            API.format(voice=self.voice_id),
            headers={"xi-api-key": self.key},
            params={"output_format": "mp3_44100_128"},
            json={"text": text, "model_id": self.model_id,
                  "voice_settings": {"stability": 0.5, "similarity_boost": 0.75,
                                     "speed": max(0.7, min(1.2, speed))}},
        )
        r.raise_for_status()
        return r.json()

    def synthesize(self, text: str, out_path: Path, speed: float = 1.0) -> TTSResult:
        data = self._request(text, speed)
        mp3 = out_path.with_suffix(".mp3")
        mp3.write_bytes(base64.b64decode(data["audio_base64"]))
        to_wav(mp3, out_path)
        al = data.get("alignment") or data.get("normalized_alignment") or {}
        words = chars_to_words(al.get("characters", []), al.get("character_start_times_seconds", []),
                               al.get("character_end_times_seconds", []))
        return TTSResult(out_path, wav_duration(out_path), words, chars=len(text))
