"""대본 → 배경음악 분위기/템포 분석 (Claude JSON, 실패 시 키워드 휴리스틱)."""
from __future__ import annotations

import logging
from functools import lru_cache
from pathlib import Path

import yaml

from ...config import load_prompt

log = logging.getLogger(__name__)
MOODS = ["upbeat", "news", "tense", "inspiring", "calm", "tech", "funny", "sad"]

MOOD_SCHEMA = {
    "type": "object",
    "properties": {
        "mood": {"type": "string", "enum": MOODS},
        "energy": {"type": "number"},
        "tempo_bpm": {"type": "integer"},
        "key": {"type": "string"},
        "reason": {"type": "string"},
    },
    "required": ["mood", "energy", "tempo_bpm", "key", "reason"],
    "additionalProperties": False,
}

KEYWORDS = {
    "sad": ["추모", "참사", "사망", "희생", "애도", "별세", "재난"],
    "tense": ["사고", "사건", "논란", "화재", "체포", "경찰", "수사", "폭발", "충돌", "속보"],
    "tech": ["AI", "인공지능", "반도체", "스마트폰", "앱", "출시", "로봇", "우주", "과학"],
    "inspiring": ["우승", "金", "금메달", "기록", "감동", "성공", "결승"],
    "funny": ["웃긴", "고양이", "강아지", "동물", "밈", "황당"],
    "calm": ["날씨", "건강", "생활", "꿀팁", "레시피", "여행"],
    "upbeat": ["아이돌", "컴백", "신곡", "트렌드", "신제품", "공개"],
}


@lru_cache(maxsize=1)
def presets() -> dict:
    return yaml.safe_load((Path(__file__).parent / "presets.yaml").read_text(encoding="utf-8"))


def heuristic(text: str) -> dict:
    for mood, kws in KEYWORDS.items():
        if any(k in text for k in kws):
            break
    else:
        mood = "news"
    lo, hi = presets()[mood]["tempo"]
    return {"mood": mood, "energy": presets()[mood]["energy"], "tempo_bpm": (lo + hi) // 2,
            "key": "", "reason": "키워드 휴리스틱"}


def clamp(result: dict) -> dict:
    mood = result.get("mood") if result.get("mood") in MOODS else "news"
    lo, hi = presets()[mood]["tempo"]
    result["mood"] = mood
    result["tempo_bpm"] = int(min(max(int(result.get("tempo_bpm") or (lo + hi) // 2), lo), hi))
    result["energy"] = float(min(max(float(result.get("energy", 0.5)), 0), 1))
    return result


def analyze_mood(llm, script: dict) -> dict:
    narration = "\n".join(s["narration"] for s in script.get("scenes", []))
    if llm is None:
        return clamp(heuristic(script.get("title", "") + narration))
    try:
        data, _ = llm.complete_json(load_prompt("mood", title=script.get("title", ""), narration=narration),
                                    schema=MOOD_SCHEMA, max_tokens=2000)
        return clamp(data)
    except Exception as e:
        from ...costs import BudgetExceeded
        if isinstance(e, BudgetExceeded):
            raise
        log.warning("mood 분석 실패 → 휴리스틱: %s", e)
        return clamp(heuristic(script.get("title", "") + narration))
