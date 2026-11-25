"""Step 4. 대본 작성 (조사 사실만 사용) + 글자 수 기반 길이 검증/재작성."""
from __future__ import annotations

import json
import logging
import re

from sqlalchemy import select

from ..config import load_prompt
from ..models import Script, Topic

log = logging.getLogger(__name__)

SCENE_SCHEMA = {
    "type": "object",
    "properties": {
        "idx": {"type": "integer"},
        "narration": {"type": "string"},
        "on_screen_text": {"type": "string"},
        "visual_query": {"type": "string"},
        "seconds": {"type": "number"},
    },
    "required": ["idx", "narration", "on_screen_text", "visual_query", "seconds"],
    "additionalProperties": False,
}

SCRIPT_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "hashtags": {"type": "array", "items": {"type": "string"}},
        "estimated_seconds": {"type": "number"},
        "scenes": {"type": "array", "items": SCENE_SCHEMA},
        "sources": {"type": "array", "items": {"type": "string"}},
        "risk_notes": {"type": "string"},
    },
    "required": ["title", "hashtags", "estimated_seconds", "scenes", "sources", "risk_notes"],
    "additionalProperties": False,
}


def narration_text(script: dict) -> str:
    return " ".join(s["narration"].strip() for s in script.get("scenes", []))


def char_count(script: dict) -> int:
    """낭독 글자 수 (공백·줄바꿈 제외)."""
    return len(re.sub(r"\s+", "", narration_text(script)))


def length_ok(n: int, target: int) -> bool:
    return target * 0.8 <= n <= target * 1.1


def normalize_script(script: dict, topic_key: str, cps: float, allowed_sources: set[str]) -> dict:
    script["topic_id"] = topic_key
    script["title"] = script.get("title", "")[:40]
    tags = []
    for h in script.get("hashtags", []):
        h = "#" + h.lstrip("#").replace(" ", "")
        if len(h) > 1 and h not in tags:
            tags.append(h)
    script["hashtags"] = tags[:6]
    for i, sc in enumerate(script.get("scenes", []), 1):
        sc["idx"] = i
        sc["on_screen_text"] = sc.get("on_screen_text", "")[:12]
        sc["seconds"] = round(len(re.sub(r"\s+", "", sc["narration"])) / cps, 1)
    # 대본 출처는 조사 자료에 있는 URL로 제한 (모든 사실 주장에 출처를 남김)
    srcs = [u for u in script.get("sources", []) if u in allowed_sources] or sorted(allowed_sources)
    script["sources"] = srcs
    script["char_count"] = char_count(script)
    script["estimated_seconds"] = round(script["char_count"] / cps, 1)
    return script


def research_brief(research: dict) -> str:
    lines = []
    for s in research.get("sources", []):
        lines.append(f"* {s.get('publisher') or s.get('title')} ({s.get('published_date', '')}) {s['url']}")
        lines += [f"  - {f}" for f in s.get("facts", [])]
    if research.get("key_facts"):
        lines.append("핵심 사실:")
        lines += [f"  - {f}" for f in research["key_facts"]]
    if research.get("contradictions"):
        lines.append("출처 간 상충(단정하지 말 것):")
        lines += [f"  - {c}" for c in research["contradictions"]]
    return "\n".join(lines)


def write_for_topic(ctx, topic: Topic) -> dict:
    sc = ctx.settings.script
    target = sc.target_chars_ko
    allowed = {s["url"] for s in (topic.research or {}).get("sources", [])}
    feedback = ""
    script: dict = {}
    for attempt in range(sc.max_rewrites + 1):
        prompt = load_prompt(
            "write_script", max_seconds=sc.max_seconds, min_chars=int(target * 0.93), max_chars=int(target * 1.07),
            tone=sc.tone, topic=topic.title, angles=" / ".join(topic.angle_ideas or []),
            research=research_brief(topic.research or {}), feedback=feedback)
        data, _ = ctx.llm.complete_json(prompt, schema=SCRIPT_SCHEMA)
        script = normalize_script(data, topic.key, sc.chars_per_second, allowed)
        n = script["char_count"]
        if length_ok(n, target):
            break
        direction = "줄여" if n > target else "늘려"
        feedback = (f"\n[재작성 요청] 직전 대본은 낭독 {n}자였다. 목표 {target}자 안팎으로 {direction}서 다시 써라. "
                    f"직전 대본: {json.dumps(data.get('scenes', []), ensure_ascii=False)}\n")
        log.info("길이 재작성 %d/%d: %s (%d자)", attempt + 1, sc.max_rewrites, topic.title, n)
    script["length_ok"] = length_ok(script["char_count"], target)
    return script


def save_script(ctx, topic: Topic, script: dict, status: str, risk_flags: list[str] | None = None) -> Script:
    version = len(topic.scripts) + 1
    row = Script(topic_id=topic.id, version=version, json=script, char_count=script["char_count"],
                 est_seconds=script["estimated_seconds"], risk_flags=risk_flags or [], approval_status=status)
    ctx.session.add(row)
    topic.scripts.append(row)
    ctx.save()
    return row


def write(ctx) -> list[Script]:
    topics = list(ctx.session.scalars(
        select(Topic).where(Topic.run_id == ctx.run.id, Topic.status == "researched").order_by(Topic.score.desc())))
    out = []
    for t in topics:
        try:
            script = write_for_topic(ctx, t)
        except Exception as e:
            from ..costs import BudgetExceeded
            if isinstance(e, BudgetExceeded):
                raise
            log.exception("대본 작성 실패: %s", t.title)
            t.status = "failed"
            continue
        row = save_script(ctx, t, script, "scripted")
        t.status = "scripted"
        ctx.write_json(f"scripts/{t.key}.v{row.version}.json", script)
        out.append(row)
        log.info("대본: %s (%d자, %.0f초)", script["title"], script["char_count"], script["estimated_seconds"])
    ctx.set_status("scripted")
    return out
