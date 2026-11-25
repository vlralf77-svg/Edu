"""ElevenLabs TTS (with-timestamps 엔드포인트 → 문자 단위 정렬로 자막 싱크)."""
from __future__ import annotations

import base64
import logging
from pathlib import Path

import httpx
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

from ...config import env
from .base import TTSProvider, TTSResult, chars_to_words, to_wav, wav_duration

log = logging.getLogger(__name__)
API = "https://api.elevenlabs.io/v1/text-to-speech/{voice}/with-timestamps"


class PaymentRequired(RuntimeError):
    pass


class ElevenLabsTTS(TTSProvider):
    name = "elevenlabs"
    supports_speed = True

    def __init__(self, voice_id: str = "", model_id: str = "eleven_multilingual_v2", http: httpx.Client | None = None,
                 **_):
        self.key = env("ELEVENLABS_API_KEY")
        if not self.key:
            raise RuntimeError("ELEVENLABS_API_KEY 가 설정되지 않았습니다 (.env)")
        self.http = http or httpx.Client(timeout=120)
        self.model_id = model_id
        self.voice_id = voice_id or self.auto_pick_voice()

    def _premade_voice(self) -> str | None:
        try:
            r = self.http.get("https://api.elevenlabs.io/v1/voices", headers={"xi-api-key": self.key})
            r.raise_for_status()
        except httpx.HTTPError:
            return None
        for v in r.json().get("voices", []):
            if v.get("category") == "premade":
                return v["voice_id"]
        return None

    @staticmethod
    def _pay_msg(e) -> str:
        return (f"ElevenLabs 결제 필요(402): {e} — 무료 크레딧을 다 썼거나 유료 플랜 전용 기능입니다. "
                "제어판 ⚙️ 설정 ▸ 음성 서비스를 'Microsoft Edge 음성(무료)'으로 바꾸면 키 없이 진행할 수 있습니다.")

    def auto_pick_voice(self) -> str:
        """보이스 ID 가 비어 있으면 계정의 목소리 중 하나를 골라 설정에 저장 (한국어 라벨 우선)."""
        try:
            r = self.http.get("https://api.elevenlabs.io/v1/voices", headers={"xi-api-key": self.key})
            r.raise_for_status()
            voices = r.json().get("voices", [])
        except httpx.HTTPError as e:
            raise RuntimeError(
                "ElevenLabs 보이스 ID 가 비어 있고 목소리 목록도 가져오지 못했습니다 "
                f"({e}). ElevenLabs 사이트 ▸ Voices 에서 목소리를 골라 'ID 복사' 후 "
                "제어판 ⚙️ 설정 ▸ 'ElevenLabs 보이스 ID' 에 붙여넣으세요.") from e
        if not voices:
            raise RuntimeError("ElevenLabs 계정에 쓸 수 있는 목소리가 없습니다. 사이트 ▸ Voices 에서 목소리를 추가하세요.")

        def rank(v):  # 무료 플랜도 API 로 쓸 수 있는 기본(premade) 목소리 우선, 그다음 한국어
            labels = " ".join(str(x) for x in (v.get("labels") or {}).values()).lower()
            korean = "korean" in labels or "ko" == (v.get("labels") or {}).get("language", "")
            return (v.get("category") != "premade", not korean)
        best = sorted(voices, key=rank)[0]
        from ...config import save_local_settings
        save_local_settings({"production": {"voice_id": best["voice_id"]}})
        log.warning("ElevenLabs 보이스 ID 가 비어 있어 '%s'(%s) 목소리를 자동 선택해 저장했습니다. "
                    "설정 화면에서 바꿀 수 있습니다.", best.get("name"), best["voice_id"])
        return best["voice_id"]

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=2, max=20), reraise=True,
           retry=retry_if_exception(lambda e: isinstance(e, httpx.TransportError) or (
               isinstance(e, httpx.HTTPStatusError) and e.response.status_code in (429, 500, 502, 503))))
    def _request(self, text: str, speed: float) -> dict:
        r = self.http.post(
            API.format(voice=self.voice_id),
            headers={"xi-api-key": self.key},
            params={"output_format": "mp3_44100_128"},
            json={"text": text, "model_id": self.model_id,
                  "voice_settings": {"stability": 0.5, "similarity_boost": 0.75,
                                     "speed": max(0.7, min(1.2, speed))}},
        )
        if r.status_code == 402 or (r.status_code == 401 and "payment" in r.text.lower()):
            raise PaymentRequired(self._detail(r))
        r.raise_for_status()
        return r.json()

    @staticmethod
    def _detail(r: httpx.Response) -> str:
        try:
            d = r.json().get("detail", {})
            return d.get("message", str(d)) if isinstance(d, dict) else str(d)
        except ValueError:
            return r.text[:300]

    def synthesize(self, text: str, out_path: Path, speed: float = 1.0) -> TTSResult:
        try:
            data = self._request(text, speed)
        except PaymentRequired as e:
            premade = self._premade_voice()
            if premade and premade != self.voice_id:  # 무료 플랜: 라이브러리 목소리 불가 → 기본 목소리로 재시도
                log.warning("ElevenLabs: 이 목소리는 유료 플랜 필요(%s) → 기본 목소리 %s 로 다시 시도", e, premade)
                self.voice_id = premade
                from ...config import save_local_settings
                save_local_settings({"production": {"voice_id": premade}})
                try:
                    data = self._request(text, speed)
                except PaymentRequired as e2:
                    raise RuntimeError(self._pay_msg(e2)) from e2
            else:
                raise RuntimeError(self._pay_msg(e)) from e
        mp3 = out_path.with_suffix(".mp3")
        mp3.write_bytes(base64.b64decode(data["audio_base64"]))
        to_wav(mp3, out_path)
        al = data.get("alignment") or data.get("normalized_alignment") or {}
        words = chars_to_words(al.get("characters", []), al.get("character_start_times_seconds", []),
                               al.get("character_end_times_seconds", []))
        return TTSResult(out_path, wav_duration(out_path), words, chars=len(text))
