"""Google Cloud TTS (선택). `pip install google-cloud-texttospeech` 필요. 타임스탬프는 글자 비례 추정."""
from __future__ import annotations

from pathlib import Path

from .base import TTSProvider, TTSResult, proportional_words, wav_duration


class GoogleTTS(TTSProvider):
    name = "google"
    supports_speed = True

    def __init__(self, voice_id: str = ""):
        try:
            from google.cloud import texttospeech  # type: ignore
        except ImportError as e:
            raise RuntimeError("google-cloud-texttospeech 패키지를 설치하세요") from e
        self.tts = texttospeech
        self.client = texttospeech.TextToSpeechClient()
        self.voice = voice_id or "ko-KR-Neural2-C"

    def synthesize(self, text: str, out_path: Path, speed: float = 1.0) -> TTSResult:
        t = self.tts
        resp = self.client.synthesize_speech(
            input=t.SynthesisInput(text=text),
            voice=t.VoiceSelectionParams(language_code="ko-KR", name=self.voice),
            audio_config=t.AudioConfig(audio_encoding=t.AudioEncoding.LINEAR16, sample_rate_hertz=44100,
                                       speaking_rate=speed),
        )
        out_path.write_bytes(resp.audio_content)
        dur = wav_duration(out_path)
        return TTSResult(out_path, dur, proportional_words(text, dur), chars=len(text))
