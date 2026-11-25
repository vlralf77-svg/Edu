"""Step 5. 팩트체크: 조사 자료와 문장 대조 + 법적 리스크 플래그."""
from __future__ import annotations

import json
import logging
import re

from sqlalchemy import select

from ..config import load_prompt
from ..models import Script, Topic
from .script_writer import SCENE_SCHEMA, normalize_script, research_brief, save_script

log = logging.getLogger(__name__)

FACT_SCHEMA = {
    "type": "object",
    "properties": {
        "scenes": {"type": "array", "items": SCENE_SCHEMA},
        "removed_sentences": {"type": "array", "items": {"type": "string"}},
        "flags": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "type": {"type": "string",
                             "enum": ["defamation", "medical", "investment", "unsupported", "sensitive"]},
                    "sentence": {"type": "string"},
                    "note": {"type": "string"},
                },
                "required": ["type", "sentence", "note"],
                "additionalProperties": False,
            },
        },
        "notes": {"type": "string"},
    },
    "required": ["scenes", "removed_sentences", "flags", "notes"],
    "additionalProperties": False,
}

# LLM 검토와 별개로 돌리는 규칙 기반 안전망
RULES = {
    "investment": re.compile(r"(매수|매도|사세요|팔으세요|투자하세요|수익\s*보장|무조건\s*오른|지금\s*사야|원금\s*보장)"),
    "medical": re.compile(r"(복용하세요|완치|치료됩니다|병원\s*안\s*가도|약을?\s*끊으세요|처방\s*받으세요)"),
    "defamation": re.compile(r"(사기꾼|범죄자|거짓말쟁이|파렴치|쓰레기)"),
}

# 리뷰 시 차단 사유가 되는 플래그 (unsupported 는 이미 수정·삭제됐으므로 정보성)
BLOCKING_FLAGS = {"defamation", "medical", "investment", "sensitive", "low_confidence", "length"}


def rule_flags(text: str) -> list[dict]:
    out = []
    for kind, rx in RULES.items():
        for m in rx.finditer(text):
            out.append({"type": kind, "sentence": m.group(0), "note": "규칙 기반 탐지"})
    return out


def check_script(ctx, topic: Topic, script: dict) -> tuple[dict, list[dict]]:
    sc = ctx.settings.script
    t = sc.target_chars_ko
    prompt = load_prompt("fact_check", script=json.dumps(script["scenes"], ensure_ascii=False, indent=1),
                         research=research_brief(topic.research or {}), min_chars=int(t * 0.9),
                         max_chars=int(t * 1.1))
    data, _ = ctx.llm.complete_json(prompt, schema=FACT_SCHEMA)
    checked = dict(script)
    if data.get("scenes"):
        checked["scenes"] = data["scenes"]
    allowed = {s["url"] for s in (topic.research or {}).get("sources", [])}
    checked = normalize_script(checked, topic.key, sc.chars_per_second, allowed)
    flags = list(data.get("flags", [])) + rule_flags(" ".join(s["narration"] for s in checked["scenes"]))
    if topic.confidence == "low":
        flags.append({"type": "low_confidence", "sentence": "", "note": "출처 2개 미만 또는 출처 간 모순"})
    if checked["estimated_seconds"] > sc.max_seconds:
        flags.append({"type": "length", "sentence": "", "note": f"예상 {checked['estimated_seconds']}초"})
    checked["fact_check"] = {"removed_sentences": data.get("removed_sentences", []), "flags": flags,
                             "notes": data.get("notes", "")}
    return checked, flags


def fact_check(ctx) -> list[Script]:
    topics = list(ctx.session.scalars(
        select(Topic).where(Topic.run_id == ctx.run.id, Topic.status == "scripted").order_by(Topic.score.desc())))
    out = []
    for t in topics:
        latest = max(t.scripts, key=lambda s: s.version)
        try:
            checked, flags = check_script(ctx, t, latest.json)
        except Exception as e:
            from ..costs import BudgetExceeded
            if isinstance(e, BudgetExceeded):
                raise
            log.exception("팩트체크 실패: %s", t.title)
            t.status = "failed"
            continue
        risk = sorted({f["type"] for f in flags})
        row = save_script(ctx, t, checked, "pending_review", risk)
        t.status = "checked"
        ctx.write_json(f"scripts/{t.key}.v{row.version}.json", checked)
        out.append(row)
        log.info("팩트체크: %s → 플래그 %s", t.title, risk or "없음")
    ctx.set_status("checked")
    return out
