"""통합 제어판 (내 PC 에서 실행하는 프로그램 화면): `python -m agent app` 또는 바탕화면 아이콘.

서버 없이 이 PC 의 브라우저 창에서 열린다(localhost, 외부에서 접속 불가).
"""
from __future__ import annotations

import os
import subprocess
import sys
import time
from datetime import time as dtime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import streamlit as st  # noqa: E402
from sqlalchemy import select  # noqa: E402

from agent.config import ENV_FILE, get_settings, read_env, save_env, save_local_settings  # noqa: E402
from agent.context import today  # noqa: E402
from agent.doctor import ready, run_checks  # noqa: E402
from agent.models import Production, Run, Script, Topic, session_scope  # noqa: E402
from agent.review.view import render_review  # noqa: E402
from agent.ui import jobs  # noqa: E402

st.set_page_config(page_title="트렌드 숏폼 에이전트", page_icon="🎬", layout="wide")
settings = get_settings()
session = session_scope(settings.db_url)

PAGES = ["🏠 홈", "✅ 후보 검토", "🎬 만든 영상", "⚙️ 설정", "⏰ 자동 실행", "🩺 점검"]
page = st.sidebar.radio("메뉴", PAGES, label_visibility="collapsed")
st.sidebar.divider()


def open_folder(path: Path) -> None:
    if sys.platform.startswith("win"):
        os.startfile(path)  # type: ignore[attr-defined]
    elif sys.platform == "darwin":
        subprocess.Popen(["open", str(path)])
    else:
        subprocess.Popen(["xdg-open", str(path)])


def job_panel() -> None:
    job = jobs.last(settings.data_dir)
    if not job:
        return
    running = job.returncode is None
    if running:
        st.info(f"⏳ 실행 중: **{job.label}** ({int(time.time() - job.started)}초 경과) — 창을 닫아도 계속 진행됩니다")
    elif job.returncode == 0:
        st.success(f"✔ 완료: {job.label}")
    elif job.returncode == -999:
        st.caption(f"지난 작업: {job.label}")
    else:
        st.error(f"✖ 실패: {job.label} — 아래 로그를 확인하세요")
    with st.expander("작업 로그", expanded=running or (job.returncode not in (0, -999))):
        st.code(jobs.tail(job.log) or "(아직 출력 없음)", language="log")
    if running:
        if st.button("⏹ 작업 중지"):
            jobs.stop()
        time.sleep(3)
        st.rerun()


def start_job(name: str, args: list[str]) -> None:
    try:
        jobs.start(name, args, settings.data_dir)
        st.rerun()
    except RuntimeError as e:
        st.warning(str(e))


# ================================================================ 홈
if page == PAGES[0]:
    st.title("🎬 트렌드 숏폼 에이전트")
    checks = run_checks(settings)
    if not ready(checks):
        missing = [c.name for c in checks if c.required and not c.ok]
        st.warning("아직 준비가 덜 됐습니다: " + ", ".join(missing) + " → **⚙️ 설정 / 🩺 점검** 메뉴에서 해결하세요")
    d = today(settings)
    run = session.scalar(select(Run).where(Run.date == d))
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("오늘 날짜", d)
    STATUS_KO = {"started": "진행 중", "collected": "수집 완료", "clustered": "주제 정리 완료", "researched": "조사 완료",
                 "scripted": "대본 작성 완료", "checked": "팩트체크 완료", "pending_review": "검토 대기"}
    c2.metric("오늘 분석", STATUS_KO.get(run.status, run.status) if run else "시작 전")
    pending = session.scalars(select(Script).where(Script.approval_status == "pending_review")).all()
    approved = session.scalars(select(Script).where(Script.approval_status == "approved")).all()
    c3.metric("검토 대기 / 승인", f"{len(pending)} / {len(approved)}")
    c4.metric("오늘 사용 비용" + (" (Gemini 무료)" if settings.llm.provider == "gemini" else ""),
              f"${run.cost_usd:.2f}" if run else "$0.00",
              help=f"하루 상한 ${settings.budget.max_daily_cost_usd}")

    st.subheader("할 일")
    b1, b2, b3 = st.columns(3)
    if b1.button("① 오늘 트렌드 분석 시작", type="primary", use_container_width=True,
                 help="YouTube 인기 영상 수집 → 주제 묶기 → 웹 조사 → 대본 작성 → 팩트체크"):
        start_job("run-daily", ["run-daily"])
    b2.markdown("② **✅ 후보 검토** 메뉴에서 승인")
    if b3.button(f"③ 승인된 영상 {len(approved)}개 제작", use_container_width=True, disabled=not approved):
        start_job("produce", ["produce", "--approved"])
    summary = settings.data_dir / "runs" / d / "summary.txt"
    if summary.exists():
        st.info("**오늘 분석 결과**\n\n" + summary.read_text(encoding="utf-8").replace("\n", "\n\n"))
    if run:
        with st.expander("결과가 이상하면: 오늘 분석을 처음부터 다시"):
            st.write("수집부터 전부 다시 합니다 (YouTube 쿼터 약 300 사용, Gemini 무료).")
            if st.button("처음부터 다시 분석"):
                start_job("run-daily", ["run-daily", "--force"])
    with st.expander("처음이라면: 키 없이 샘플 영상 만들어 보기"):
        st.write("API 키 없이 샘플 대본으로 영상 제작 과정을 시험합니다 (테스트 음성·글자 화면).")
        if st.button("샘플 영상 만들기"):
            start_job("sample", ["sample"])
    job_panel()

# ================================================================ 검토
elif page == PAGES[1]:
    render_review(settings, box=st.sidebar)

# ================================================================ 만든 영상
elif page == PAGES[2]:
    st.header("🎬 만든 영상")
    rows = session.execute(select(Production, Script, Topic).join(Script, Production.script_id == Script.id)
                           .join(Topic, Script.topic_id == Topic.id).order_by(Production.id.desc())).all()
    if not rows:
        st.info("아직 만든 영상이 없습니다.")
    for prod, script, topic in rows:
        title = script.json.get("title", topic.title)
        icon = {"produced": "✅", "uploaded": "📤", "failed": "⚠️"}.get(prod.status, "⏳")
        with st.expander(f"{icon} #{prod.id} {title} · {prod.created_at:%m-%d %H:%M}", expanded=prod is rows[0][0]):
            if prod.status in ("produced", "uploaded") and prod.video_path and Path(prod.video_path).exists():
                vp = Path(prod.video_path)
                c1, c2 = st.columns([1, 1])
                with c1:
                    st.video(str(vp))
                with c2:
                    st.download_button("⬇ 영상 저장", vp.read_bytes(), file_name=f"{title[:30]}.mp4",
                                       mime="video/mp4", key=f"dl{prod.id}")
                    if st.button("📂 폴더 열기", key=f"of{prod.id}"):
                        open_folder(vp.parent)
                    meta = vp.parent / "meta.json"
                    if meta.exists():
                        import json
                        m = json.loads(meta.read_text(encoding="utf-8"))
                        st.text_input("제목 (복사해서 업로드에 사용)", m.get("title", ""), key=f"t{prod.id}")
                        st.text_area("설명란 (출처·크레딧 포함)", m.get("description", ""), height=220, key=f"d{prod.id}")
                    st.caption(f"길이 {prod.duration:.0f}초 · YouTube 업로드 시 '변경되거나 합성된 콘텐츠'를 '예'로 설정하세요")
            elif prod.status == "failed":
                st.error(prod.error)

# ================================================================ 설정
elif page == PAGES[3]:
    st.header("⚙️ 설정")
    env = read_env()
    st.subheader("API 키")
    st.caption(f"키는 이 PC 의 `{ENV_FILE}` 파일에만 저장됩니다. 칸을 비워 두면 기존 값이 유지됩니다.")
    KEYS = [
        ("GEMINI_API_KEY", "Gemini API 키 (무료 — LLM 을 Gemini 로 쓸 때)", "https://aistudio.google.com/apikey"),
        ("ANTHROPIC_API_KEY", "Claude API 키 (유료 — LLM 을 Claude 로 쓸 때)", "https://console.anthropic.com"),
        ("YOUTUBE_API_KEY", "YouTube Data API 키 (필수, 무료)", "https://console.cloud.google.com/apis/library/youtube.googleapis.com"),
        ("PIXABAY_API_KEY", "Pixabay 키 (무료 — 실사 영상, 이것 또는 Pexels 하나 필요)", "https://pixabay.com/api/docs/"),
        ("PEXELS_API_KEY", "Pexels 키 (무료 — 신규 발급이 중단돼 있을 수 있음)", "https://www.pexels.com/api/"),
        ("ELEVENLABS_API_KEY", "ElevenLabs 키 (음성)", "https://elevenlabs.io"),
        ("SLACK_WEBHOOK_URL", "Slack 웹훅 (선택, 알림)", "https://api.slack.com/messaging/webhooks"),
        ("TELEGRAM_BOT_TOKEN", "Telegram 봇 토큰 (선택, 알림)", "https://core.telegram.org/bots"),
        ("TELEGRAM_CHAT_ID", "Telegram 채팅 ID (선택)", ""),
    ]
    with st.form("keys"):
        vals = {}
        for k, label, url in KEYS:
            has = bool(env.get(k) or os.environ.get(k))
            vals[k] = st.text_input(f"{label} {'✅ 설정됨' if has else '❌ 없음'}", type="password", key=k,
                                    help=f"발급: {url}" if url else None)
        if st.form_submit_button("키 저장", type="primary"):
            save_env(vals)
            st.success("저장했습니다.")
            st.rerun()

    st.subheader("동작 설정")
    s = settings
    MODELS = {"claude-opus-5-5": "Opus 5.5 (품질 우선)", "claude-sonnet-5-5": "Sonnet 5.5 (균형)",
              "claude-haiku-5-5": "Haiku 5.5 (비용 최소)"}
    VIS = {"commons": "인물·기관 실제 사진 (Wikimedia)", "pexels_video": "Pexels 실사 영상", "pixabay_video": "Pixabay 실사 영상",
           "pexels": "Pexels 사진", "pixabay": "Pixabay 사진"}
    with st.form("settings"):
        c1, c2 = st.columns(2)
        with c1:
            topics = st.slider("하루 주제 수 (많을수록 비용↑)", 1, 15, s.topics.max_topics_per_day)
            cost = st.number_input("하루 비용 상한 (달러, 넘으면 자동 중단)", 0.1, 50.0, float(s.budget.max_daily_cost_usd), 0.1)
            provider = st.radio("분석·대본 AI", ["gemini", "claude"], index=["gemini", "claude"].index(s.llm.provider),
                                format_func={"gemini": "Google Gemini (무료 등급)", "claude": "Anthropic Claude (유료)"}.get,
                                horizontal=True)
            gmodel = st.text_input("Gemini 모델 이름", s.llm.gemini_model,
                                   help="없어진 이름이면 사용 가능한 flash 모델로 자동 전환됩니다")
            model = st.selectbox("Claude 모델 (Claude 선택 시)", list(MODELS), index=list(MODELS).index(s.llm.model)
                                 if s.llm.model in MODELS else 0, format_func=MODELS.get)
            run_at = st.time_input("매일 실행 시각", value=dtime(*map(int, s.schedule.run_at.split(":"))))
            approval = st.toggle("사람이 승인한 것만 제작 (권장)", s.review.require_approval)
            auto_n = st.number_input("승인 없이 자동 제작할 개수 (위 옵션 끈 경우)", 1, 10, s.review.auto_produce_top_n)
        with c2:
            tts = st.selectbox("음성 서비스", ["elevenlabs", "google", "dummy"],
                               index=["elevenlabs", "google", "dummy"].index(s.production.tts_provider),
                               format_func={"elevenlabs": "ElevenLabs", "google": "Google Cloud TTS",
                                            "dummy": "테스트용(실제 목소리 아님)"}.get)
            voice = st.text_input("ElevenLabs 보이스 ID", s.production.voice_id)
            vis = st.multiselect("화면 소스 (위에서부터 우선)", list(VIS), s.production.visual_sources, format_func=VIS.get)
            cats = st.multiselect("수집 카테고리 (비우면 전체)", [25, 24, 28, 17, 10, 20, 22, 26],
                                  s.collect.category_ids,
                                  format_func={25: "뉴스·정치", 24: "엔터테인먼트", 28: "과학기술", 17: "스포츠",
                                               10: "음악", 20: "게임", 22: "인물·블로그", 26: "노하우·스타일"}.get)
            excl = st.text_input("제외 키워드 (쉼표로 구분)", ", ".join(s.collect.exclude_keywords))
            RP = {"auto": "자동 (Gemini면 구글 뉴스, Claude면 AI 검색)", "news": "구글 뉴스 RSS (무료·키 불필요)",
                  "llm": "AI 내장 웹 검색 (Gemini 무료는 한도 매우 작음)", "tavily": "Tavily (키 필요)", "serper": "Serper (키 필요)"}
            rprov = st.selectbox("웹 조사 방식", list(RP), index=list(RP).index(s.research.provider)
                                 if s.research.provider in RP else 0, format_func=RP.get)
            notify_on = st.toggle("Slack/Telegram 알림 보내기", s.notify.enabled)
        if st.form_submit_button("설정 저장", type="primary"):
            save_local_settings({
                "topics": {"max_topics_per_day": topics}, "budget": {"max_daily_cost_usd": float(cost)},
                "llm": {"provider": provider, "gemini_model": gmodel.strip(), "model": model}, "schedule": {"run_at": run_at.strftime("%H:%M")},
                "review": {"require_approval": approval, "auto_produce_top_n": int(auto_n)},
                "production": {"tts_provider": tts, "voice_id": voice.strip(), "visual_sources": vis},
                "collect": {"category_ids": cats, "exclude_keywords": [x.strip() for x in excl.split(",") if x.strip()]},
                "notify": {"enabled": notify_on},
                "research": {"provider": rprov},
            })
            st.success("저장했습니다. (실행 시각을 바꿨다면 ⏰ 자동 실행에서 다시 등록하세요)")
            st.rerun()

# ================================================================ 자동 실행
elif page == PAGES[4]:
    from agent.scheduler import install_schedule, is_due, local_hhmm, schedule_status, uninstall_schedule
    st.header("⏰ 자동 실행")
    st.write(f"매일 **{settings.schedule.run_at}** ({settings.schedule.timezone}) = 이 PC 시각 **{local_hhmm(settings)}** 에 "
             "트렌드 분석을 자동으로 실행합니다. 서버 없이 이 PC 의 예약 작업 기능을 사용합니다.")
    st.info("PC 가 그 시각에 꺼져 있었다면, 다음에 PC 를 켜고 로그인할 때 자동으로 보충 실행됩니다. "
            "사람 승인 모드에서는 분석까지만 자동이고, 영상 제작은 검토 후 버튼으로 진행합니다.")
    status = schedule_status()
    if status:
        st.success("✅ 자동 실행이 등록되어 있습니다")
        with st.expander("등록 내용"):
            st.code(status)
    else:
        st.warning("자동 실행이 등록되어 있지 않습니다")
    c1, c2 = st.columns(2)
    if c1.button("자동 실행 등록 / 다시 등록", type="primary"):
        try:
            st.success(install_schedule(settings))
        except Exception as e:  # noqa: BLE001
            st.error(f"등록 실패: {e}")
    if c2.button("자동 실행 해제", disabled=not status):
        st.success(uninstall_schedule())
    st.caption(f"오늘 실행 필요 여부: {'예' if is_due(settings) else '아니오 (이미 실행했거나 예정 시각 전)'}")

# ================================================================ 점검
elif page == PAGES[5]:
    st.header("🩺 환경 점검")
    checks = run_checks(settings)
    for c in checks:
        icon = "✅" if c.ok else ("❌" if c.required else "➖")
        st.markdown(f"{icon} **{c.name}** — {c.detail}")
        if not c.ok and c.fix:
            st.caption(f"　 해결: {c.fix}")
    st.divider()
    if ready(checks):
        st.success("필수 항목이 모두 준비됐습니다.")
    if st.button("YouTube 수집만 시험해 보기 (비용 없음)"):
        start_job("collect", ["collect"])
    job_panel()

st.sidebar.caption(f"데이터 폴더: {settings.data_dir}")
