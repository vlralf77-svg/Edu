"""한글 폰트 탐색: settings.production.font_path → assets/fonts → 시스템(Noto Sans CJK KR / Pretendard)."""
from __future__ import annotations

import subprocess
from functools import lru_cache
from pathlib import Path

from PIL import ImageFont

from ..config import PROJECT_ROOT


@lru_cache(maxsize=4)
def find_font(preferred: str = "") -> tuple[Path, int]:
    """(폰트 파일 경로, TTC 인덱스) 반환."""
    if preferred and Path(preferred).exists():
        return Path(preferred), 0
    local = sorted((PROJECT_ROOT / "assets" / "fonts").glob("*.[ot]t[fc]"))
    bold = [p for p in local if "bold" in p.name.lower()]
    if bold or local:
        return (bold or local)[0], 0
    for pattern in ("Pretendard:style=Bold", "Noto Sans CJK KR:style=Bold", "Noto Sans CJK KR", "NanumGothic"):
        try:
            out = subprocess.run(["fc-match", "-f", "%{file}|%{index}|%{family}", pattern],
                                 capture_output=True, text=True, check=True).stdout
        except (OSError, subprocess.CalledProcessError):
            break
        path, idx, family = (out.split("|") + ["0", ""])[:3]
        if path and any(k in family for k in ("CJK", "Pretendard", "Nanum")):
            # fc-match 의 index 는 TTC 전체 기준. KR 은 CJK TTC 안에서 별도 index 를 가진다.
            return Path(path), _kr_index(Path(path), int(idx or 0))
    raise RuntimeError("한글 폰트를 찾을 수 없습니다. assets/fonts 에 Pretendard 또는 Noto Sans KR 을 넣으세요.")


def _kr_index(path: Path, default: int) -> int:
    if path.suffix.lower() != ".ttc":
        return default
    for i in range(12):
        try:
            name = ImageFont.truetype(str(path), 20, index=i).getname()[0]
        except OSError:
            break
        if name.endswith(" KR"):
            return i
    return default


def font(size: int, preferred: str = "") -> ImageFont.FreeTypeFont:
    path, idx = find_font(preferred)
    return ImageFont.truetype(str(path), size, index=idx)


def family_name(preferred: str = "") -> str:
    return font(20, preferred).getname()[0]
