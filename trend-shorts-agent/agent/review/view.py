"""검토 화면 본문 (단독 검토 앱과 통합 제어판에서 같이 사용)."""
from __future__ import annotations

import json

import streamlit as st
from sqlalchemy import select

from agent.models import Run, session_scope
from agent.review.actions import BLOCKING_FLAGS, candidates, decide, edit_script


def render_review(settings, box=None) -> None:
    box = box or st.sidebar
    session = session_scope(settings.db_url)

    dates = [r.date for r in session.scalars(select(Run).order_by(Run.date.desc()))]
    if not dates:
        st.info("아직 실행 기록이 없습니다. 홈에서 [오늘 트렌드 분석 시작] 을 눌러 주세요.")
        return

    run_date = box.selectbox("실행 날짜", dates)
    run = session.scalar(select(Run).where(Run.date == run_date))
    box.metric("이 run 비용", f"${run.cost_usd:.2f}")
    box.metric("YouTube 쿼터", f"{run.quota_used:,}")
    status_filter = box.multiselect("상태", ["pending_review", "approved", "rejected", "on_hold"],
                                           default=["pending_review", "on_hold"])

    st.header(f"✅ 숏폼 후보 검토 — {run_date}")
    items = [(t, s) for t, s in candidates(session, run_date) if s.approval_status in status_filter]
    if not items:
        st.write("해당 상태의 후보가 없습니다.")

    for rank, (topic, script) in enumerate(items, 1):
        j = script.json
        blocking = set(script.risk_flags or []) & BLOCKING_FLAGS
        head = f"{rank}. {topic.title} · 점수 {topic.score:.1f} · {script.est_seconds:.0f}초 · `{script.approval_status}`"
        with st.expander(("⚠️ " if blocking else "") + head, expanded=rank <= 3):
            c1, c2 = st.columns([3, 2])
            with c1:
                st.subheader(j.get("title", ""))
                st.caption(" ".join(j.get("hashtags", [])))
                edited_scenes = []
                for sc in j.get("scenes", []):
                    txt = st.text_area(f"장면 {sc['idx']} · [{sc['on_screen_text']}] · 🎞 {sc['visual_query']}"
                                       + (f" · 👤 {sc['visual_subject']}" if sc.get("visual_subject") else ""),
                                       sc["narration"], key=f"n-{script.id}-{sc['idx']}", height=70)
                    edited_scenes.append({**sc, "narration": txt})
            with c2:
                st.markdown(f"**리스크 플래그**: {', '.join(script.risk_flags or []) or '없음'}")
                for f in j.get("fact_check", {}).get("flags", []):
                    st.warning(f"{f['type']}: {f['sentence']} — {f['note']}")
                st.markdown(f"**신뢰도**: {topic.confidence or '-'}")
                st.markdown("**출처**")
                for u in j.get("sources", []):
                    st.markdown(f"- {u}")
                st.markdown("**근거 영상** (트렌드 파악용)")
                for v in topic.videos[:5]:
                    st.markdown(f"- [{v.title}](https://youtu.be/{v.video_id}) · {v.view_count:,}회")
            note = st.text_input("메모", script.reviewer_note or "", key=f"note-{script.id}")
            b1, b2, b3, b4 = st.columns(4)
            if b1.button("✅ 승인", key=f"a-{script.id}"):
                decide(session, script.id, "approve", note)
                st.rerun()
            if b2.button("⏸ 보류", key=f"h-{script.id}"):
                decide(session, script.id, "hold", note)
                st.rerun()
            if b3.button("❌ 반려", key=f"r-{script.id}"):
                decide(session, script.id, "reject", note)
                st.rerun()
            if b4.button("💾 수정 저장", key=f"e-{script.id}"):
                new = edit_script(session, script.id, {**j, "scenes": edited_scenes}, settings.script.chars_per_second)
                st.success(f"새 버전 v{new.version} 저장 (검토 대기)")
                st.rerun()
            with st.popover("JSON"):
                st.code(json.dumps(j, ensure_ascii=False, indent=2), language="json")
