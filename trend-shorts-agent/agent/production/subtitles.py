"""TTS 단어 타임스탬프 → SRT/ASS 자막 (한 줄 최대 14자, 화면 중앙 하단, 외곽선)."""
from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

from .tts.base import Word


@dataclass
class Cue:
    start: float
    end: float
    text: str


def build_cues(words: list[Word], max_chars: int = 14, min_dur: float = 0.6) -> list[Cue]:
    cues: list[Cue] = []
    buf: list[Word] = []

    def flush():
        if buf:
            cues.append(Cue(buf[0].start, buf[-1].end, " ".join(w.text for w in buf)))
            buf.clear()

    for w in words:
        text = w.text
        # 한 단어가 너무 길면 강제로 쪼갠다
        while len(text) > max_chars:
            flush()
            part = text[:max_chars]
            frac = len(part) / len(text)
            mid = w.start + (w.end - w.start) * frac
            cues.append(Cue(w.start, mid, part))
            w = Word(text[max_chars:], mid, w.end)
            text = w.text
        cand = " ".join([*(x.text for x in buf), text])
        if buf and len(cand) > max_chars:
            flush()
        buf.append(Word(text, w.start, w.end))
        if text.endswith((".", "?", "!", "요", "다.")) and len(" ".join(x.text for x in buf)) >= max_chars * 0.6:
            flush()
    flush()
    for i, c in enumerate(cues):  # 너무 짧은 자막은 다음 자막 시작 전까지 늘림
        nxt = cues[i + 1].start if i + 1 < len(cues) else c.end + min_dur
        if c.end - c.start < min_dur:
            c.end = min(c.start + min_dur, nxt)
    return cues


def _ts(t: float, sep: str = ",") -> str:
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d}{sep}{ms:03d}"


def write_srt(cues: list[Cue], path: Path) -> None:
    path.write_text("\n".join(f"{i}\n{_ts(c.start)} --> {_ts(c.end)}\n{c.text}\n" for i, c in enumerate(cues, 1)),
                    encoding="utf-8")


STYLE_SUB = {  # 스타일별 자막 모양: (한 줄 최대 글자, 글자 크기, 아래 여백 비율)
    "classic": (14, 92, 0.22),
    "dynamic": (7, 124, 0.30),   # 한두 단어씩 크게 툭툭
    "cartoon": (12, 96, 0.20),   # 말풍선 상자
}
_NUM = re.compile(r"(\d[\d,.:%]*\S*)")


def _highlight(text: str) -> str:
    """숫자(점수·기록)는 노란색으로 강조 (ASS 색상은 BGR)."""
    return _NUM.sub(lambda m: "{\\c&H0000D4FF&}" + m.group(1) + "{\\c&H00FFFFFF&}", text)


def write_ass(cues: list[Cue], path: Path, font_family: str, size: tuple[int, int], style: str = "classic") -> None:
    w, h = size
    _, fsize, margin = STYLE_SUB.get(style, STYLE_SUB["classic"])

    def ats(t: float) -> str:
        cs = int(round(t * 100))
        hh, cs = divmod(cs, 360000)
        mm, cs = divmod(cs, 6000)
        ss, cs = divmod(cs, 100)
        return f"{hh}:{mm:02d}:{ss:02d}.{cs:02d}"

    if style == "cartoon":  # 노란 말풍선 상자 + 진한 글씨 (BorderStyle 3 = 상자)
        style_line = (f"Style: Default,{font_family},{fsize},&H00281E14,&H00281E14,&H0050E6FF,&H64000000,-1,0,0,0,"
                      f"100,100,0,0,3,18,0,2,80,80,{int(h * margin)},1")
        fmt = str
    else:
        outline = 8 if style == "dynamic" else 6
        style_line = (f"Style: Default,{font_family},{fsize},&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,-1,0,0,0,"
                      f"100,100,0,0,1,{outline},2,2,60,60,{int(h * margin)},1")
        fmt = _highlight if style == "dynamic" else str
    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {w}
PlayResY: {h}
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
{style_line}

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    body = "".join(f"Dialogue: 0,{ats(c.start)},{ats(c.end)},Default,,0,0,0,,{fmt(c.text)}\n" for c in cues)
    path.write_text(header + body, encoding="utf-8")
