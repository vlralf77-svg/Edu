"""TTS 단어 타임스탬프 → SRT/ASS 자막 (한 줄 최대 14자, 화면 중앙 하단, 외곽선)."""
from __future__ import annotations

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


def write_ass(cues: list[Cue], path: Path, font_family: str, size: tuple[int, int]) -> None:
    w, h = size

    def ats(t: float) -> str:
        cs = int(round(t * 100))
        hh, cs = divmod(cs, 360000)
        mm, cs = divmod(cs, 6000)
        ss, cs = divmod(cs, 100)
        return f"{hh}:{mm:02d}:{ss:02d}.{cs:02d}"

    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {w}
PlayResY: {h}
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{font_family},92,&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,-1,0,0,0,100,100,0,0,1,6,2,2,60,60,{int(h * 0.22)},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    body = "".join(f"Dialogue: 0,{ats(c.start)},{ats(c.end)},Default,,0,0,0,,{c.text}\n" for c in cues)
    path.write_text(header + body, encoding="utf-8")
