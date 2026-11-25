"""검토 로직 (UI 와 분리해 테스트 가능하게): 후보 조회, 승인/반려/보류/수정, 자동 승인, shortlist.md."""
from __future__ import annotations

import logging
import re
from pathlib import Path

from sqlalchemy import select

from ..models import Run, Script, Topic
from ..writing.fact_checker import BLOCKING_FLAGS
from ..writing.script_writer import char_count

log = logging.getLogger(__name__)

DECISIONS = {"approve": "approved", "reject": "rejected", "hold": "on_hold", "pending": "pending_review"}


def latest_script(topic: Topic) -> Script | None:
    return max(topic.scripts, key=lambda s: s.version) if topic.scripts else None


def candidates(session, run_date: str) -> list[tuple[Topic, Script]]:
    run = session.scalar(select(Run).where(Run.date == run_date))
    if not run:
        return []
    out = []
    for t in session.scalars(select(Topic).where(Topic.run_id == run.id).order_by(Topic.score.desc())):
        s = latest_script(t)
        if s and s.approval_status in DECISIONS.values():
            out.append((t, s))
    return out


def decide(session, script_id: int, decision: str, note: str = "") -> Script:
    if decision not in DECISIONS:
        raise ValueError(f"알 수 없는 결정: {decision}")
    s = session.get(Script, script_id)
    if s is None:
        raise LookupError(f"script {script_id} 없음")
    s.approval_status = DECISIONS[decision]
    s.reviewer_note = note
    session.commit()
    log.info("검토: script %d → %s", script_id, s.approval_status)
    return s


def edit_script(session, script_id: int, new_json: dict, cps: float) -> Script:
    """수정본은 새 버전으로 저장하고 기존 버전은 superseded 처리."""
    old = session.get(Script, script_id)
    new_json = dict(new_json)
    new_json["char_count"] = char_count(new_json)
    new_json["estimated_seconds"] = round(new_json["char_count"] / cps, 1)
    for sc in new_json["scenes"]:
        sc["seconds"] = round(len(re.sub(r"\s+", "", sc["narration"])) / cps, 1)
    new = Script(topic_id=old.topic_id, version=old.version + 1, json=new_json, char_count=new_json["char_count"],
                 est_seconds=new_json["estimated_seconds"], risk_flags=old.risk_flags,
                 approval_status="pending_review", reviewer_note="사람이 수정")
    old.approval_status = "superseded"
    session.add(new)
    session.commit()
    return new


def auto_approve(session, run_date: str, top_n: int) -> list[Script]:
    """require_approval=false 일 때: 차단 플래그 없는 상위 N개 자동 승인."""
    approved = []
    for _t, s in candidates(session, run_date):
        if len(approved) >= top_n:
            break
        if s.approval_status == "pending_review" and not (set(s.risk_flags or []) & BLOCKING_FLAGS):
            s.approval_status = "approved"
            s.reviewer_note = "자동 승인"
            approved.append(s)
    session.commit()
    return approved


def render_shortlist(session, run_date: str) -> str:
    lines = [f"# 오늘의 숏폼 후보 — {run_date}", ""]
    for rank, (t, s) in enumerate(candidates(session, run_date), 1):
        j = s.json
        flags = ", ".join(s.risk_flags or []) or "없음"
        warn = " ⚠️" if set(s.risk_flags or []) & BLOCKING_FLAGS else ""
        lines += [
            f"## {rank}. {t.title}{warn}",
            f"- script_id: **{s.id}** · 상태: `{s.approval_status}` · 점수: {t.score:.1f} · 신뢰도: {t.confidence or '-'}",
            f"- 영상 제목 후보: {j.get('title', '')}",
            f"- 예상 길이: {s.est_seconds:.0f}초 ({s.char_count}자) · 리스크: {flags}",
            "- 근거 영상: " + (", ".join(f"[{v.title[:30]}](https://youtu.be/{v.video_id}) {v.view_count:,}회"
                                       for v in t.videos[:5]) or "-"),
            "- 출처: " + (" ".join(f"<{u}>" for u in j.get("sources", [])) or "-"),
            "",
            "> " + "\n> ".join(f"[{sc['on_screen_text']}] {sc['narration']}" for sc in j.get("scenes", [])),
            "",
        ]
    return "\n".join(lines)


def write_shortlist(ctx) -> Path:
    path = ctx.run_dir / "shortlist.md"
    path.write_text(render_shortlist(ctx.session, ctx.run_date), encoding="utf-8")
    return path
