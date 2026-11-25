"""외부 프로그램(FFmpeg/FFprobe) 찾기 + Windows 에서 없으면 자동 다운로드.

Windows 에서 'FileNotFoundError: [WinError 2]' 는 대부분 FFmpeg 를 못 찾아서 생긴다.
PATH 에 없더라도 흔한 설치 위치(winget, C:\\ffmpeg 등)와 프로젝트의 tools\\ffmpeg 폴더를 찾아보고,
그래도 없으면 gyan.dev 의 FFmpeg 빌드를 내려받아 tools\\ffmpeg 에 넣는다 (관리자 권한 불필요).
"""
from __future__ import annotations

import glob
import logging
import os
import shutil
import sys
import zipfile
from functools import lru_cache
from pathlib import Path

from .config import PROJECT_ROOT

log = logging.getLogger(__name__)
IS_WIN = sys.platform.startswith("win")
LOCAL_DIR = PROJECT_ROOT / "tools" / "ffmpeg"
FFMPEG_ZIP_URL = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"


class ToolMissing(RuntimeError):
    pass


def _candidates(name: str) -> list[str]:
    exe = name + (".exe" if IS_WIN else "")
    c = [str(LOCAL_DIR / exe)]
    if IS_WIN:
        la = os.environ.get("LOCALAPPDATA", "")
        c += [os.path.join(la, "Microsoft", "WinGet", "Links", exe)]
        c += sorted(glob.glob(os.path.join(la, "Microsoft", "WinGet", "Packages", "Gyan.FFmpeg*", "*", "bin", exe)),
                    reverse=True)
        c += [rf"C:\ffmpeg\bin\{exe}", rf"C:\Program Files\ffmpeg\bin\{exe}",
              os.path.join(os.environ.get("USERPROFILE", ""), "scoop", "shims", exe),
              rf"C:\ProgramData\chocolatey\bin\{exe}"]
    else:
        c += [f"/opt/homebrew/bin/{name}", f"/usr/local/bin/{name}", f"/usr/bin/{name}"]
    return c


@lru_cache(maxsize=8)
def find_tool(name: str) -> str | None:
    for p in _candidates(name)[:1]:  # 프로젝트 안 tools 폴더 우선
        if os.path.isfile(p):
            return p
    w = shutil.which(name)
    if w:
        return w
    for p in _candidates(name)[1:]:
        if p and os.path.isfile(p):
            return p
    return None


def tool(name: str) -> str:
    """실행 파일 경로. 없으면 (Windows) 자동 설치 시도 후, 그래도 없으면 해결 방법이 담긴 오류."""
    path = find_tool(name)
    if path:
        return path
    if IS_WIN and name in ("ffmpeg", "ffprobe"):
        install_ffmpeg()
        path = find_tool(name)
        if path:
            return path
    how = ("제어판 🩺 점검 ▸ [FFmpeg 자동 설치] 를 누르거나 install_windows.bat 를 다시 실행하세요" if IS_WIN
           else "Mac: brew install ffmpeg / Linux: sudo apt install ffmpeg")
    raise ToolMissing(f"'{name}' 프로그램을 찾을 수 없습니다 (영상 합성에 필요). {how}")


def install_ffmpeg(url: str = FFMPEG_ZIP_URL, http=None) -> Path:
    """gyan.dev FFmpeg essentials 빌드를 받아 tools/ffmpeg 에 ffmpeg·ffprobe 만 풀어 둔다."""
    import httpx
    LOCAL_DIR.mkdir(parents=True, exist_ok=True)
    zpath = LOCAL_DIR / "ffmpeg.zip"
    log.warning("FFmpeg 를 내려받는 중입니다 (약 100MB, 처음 한 번만)... %s", url)
    client = http or httpx.Client(timeout=600, follow_redirects=True)
    with client.stream("GET", url) as r:
        r.raise_for_status()
        with open(zpath, "wb") as f:
            for chunk in r.iter_bytes(1 << 20):
                f.write(chunk)
    found = []
    with zipfile.ZipFile(zpath) as z:
        for m in z.namelist():
            base = m.rsplit("/", 1)[-1].lower()
            if "/bin/" in m and base in ("ffmpeg.exe", "ffprobe.exe", "ffmpeg", "ffprobe"):
                (LOCAL_DIR / base).write_bytes(z.read(m))
                found.append(base)
    zpath.unlink(missing_ok=True)
    find_tool.cache_clear()
    if not found:
        raise ToolMissing("FFmpeg 압축 파일에서 실행 파일을 찾지 못했습니다")
    log.warning("FFmpeg 설치 완료: %s", LOCAL_DIR)
    return LOCAL_DIR
