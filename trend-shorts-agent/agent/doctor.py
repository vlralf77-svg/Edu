"""환경 점검: 이 PC 에서 에이전트를 돌릴 준비가 됐는지 항목별로 확인하고 해결 방법을 알려준다."""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
from dataclasses import dataclass

from .config import Settings


@dataclass
class Check:
    name: str
    ok: bool
    detail: str
    fix: str = ""
    required: bool = True


def _ffmpeg_has_filters() -> bool:
    try:
        out = subprocess.run(["ffmpeg", "-hide_banner", "-filters"], capture_output=True, text=True,
                             timeout=20).stdout
    except (OSError, subprocess.TimeoutExpired):
        return False
    return " ass " in out and " zoompan " in out and " loudnorm " in out


def run_checks(settings: Settings) -> list[Check]:
    win, mac = sys.platform.startswith("win"), sys.platform == "darwin"
    ff_fix = ("설치 프로그램(install_windows.bat)을 다시 실행하거나 PowerShell 에서: winget install Gyan.FFmpeg" if win
              else "brew install ffmpeg" if mac else "sudo apt install ffmpeg")
    checks = [
        Check("Python 3.11 이상", sys.version_info >= (3, 11), sys.version.split()[0]),
        Check("FFmpeg (영상 합성)", bool(shutil.which("ffmpeg")), shutil.which("ffmpeg") or "없음", ff_fix),
        Check("FFprobe (결과 검증)", bool(shutil.which("ffprobe")), shutil.which("ffprobe") or "없음", ff_fix),
    ]
    if shutil.which("ffmpeg"):
        checks.append(Check("FFmpeg 자막·효과 필터", _ffmpeg_has_filters(), "ass / zoompan / loudnorm",
                            "자막 기능이 포함된 전체 빌드가 필요합니다 (" + ff_fix + ")"))
    try:
        from .production.fonts import find_font
        path, _ = find_font(settings.production.font_path)
        checks.append(Check("한글 폰트", True, str(path)))
    except RuntimeError as e:
        checks.append(Check("한글 폰트", False, str(e), "assets/fonts 폴더에 Pretendard 또는 Noto Sans KR 폰트 파일을 넣으세요"))
    from .production.bgm.generator import fluidsynth_available
    sf = fluidsynth_available(settings.resolve(settings.bgm.soundfont))
    checks.append(Check("배경음악 고급 음원(fluidsynth)", sf is not None,
                        f"사용: {sf}" if sf else "없음 → 내장 신시사이저로 생성 (동작에는 문제 없음)",
                        "선택 사항: fluidsynth 와 FluidR3_GM.sf2 를 설치하면 악기 소리가 더 자연스러워집니다", required=False))

    def key(name: str, label: str, url: str, required: bool = True):
        v = os.environ.get(name, "")
        checks.append(Check(label, bool(v), "설정됨" if v else "없음", f"설정 탭에 입력 ({url})", required))

    key("ANTHROPIC_API_KEY", "Claude API 키 (분석·대본)", "console.anthropic.com")
    key("YOUTUBE_API_KEY", "YouTube Data API 키 (트렌드 수집)", "console.cloud.google.com")
    key("PEXELS_API_KEY", "Pexels 키 (실사 영상 클립)", "pexels.com/api")
    key("PIXABAY_API_KEY", "Pixabay 키 (추가 영상 클립)", "pixabay.com/api/docs", required=False)
    tts = settings.production.tts_provider
    if tts == "elevenlabs":
        key("ELEVENLABS_API_KEY", "ElevenLabs 키 (음성)", "elevenlabs.io")
        checks.append(Check("ElevenLabs 보이스 ID", bool(settings.production.voice_id),
                            settings.production.voice_id or "없음", "설정 탭 > 음성 보이스 ID"))
    elif tts == "dummy":
        checks.append(Check("음성(TTS)", False, "테스트용 dummy (실제 목소리 아님)", "설정 탭에서 음성 서비스를 선택하세요"))
    try:
        settings.data_dir.mkdir(parents=True, exist_ok=True)
        (settings.data_dir / ".write_test").write_text("ok")
        (settings.data_dir / ".write_test").unlink()
        checks.append(Check("데이터 폴더 쓰기", True, str(settings.data_dir)))
    except OSError as e:
        checks.append(Check("데이터 폴더 쓰기", False, str(e)))
    return checks


def ready(checks: list[Check]) -> bool:
    return all(c.ok for c in checks if c.required)
