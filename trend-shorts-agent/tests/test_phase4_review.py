"""Phase 4: 승인/반려/보류/수정이 DB에 반영, 자동 승인, 알림."""
import pytest

from agent.context import RunContext
from agent.models import Script, Topic
from agent.notify import notify
from agent.review.actions import auto_approve, candidates, decide, edit_script, render_shortlist


def _seed(ctx, flags_per_topic):
    ids = []
    for i, flags in enumerate(flags_per_topic):
        t = Topic(run_id=ctx.run.id, key=f"t{i}", title=f"주제{i}", score=100 - i)
        ctx.session.add(t)
        ctx.session.flush()
        s = Script(topic_id=t.id, version=1, json={"title": f"제목{i}", "scenes": [
            {"idx": 1, "narration": "안녕하세요 여러분", "on_screen_text": "인사", "visual_query": "hello"}],
            "sources": []}, char_count=8, est_seconds=2, risk_flags=flags, approval_status="pending_review")
        ctx.session.add(s)
        ctx.session.flush()
        ids.append(s.id)
    ctx.session.commit()
    return ids


def test_decisions_persist(settings):
    with RunContext("2026-11-25", settings) as ctx:
        a, b, c = _seed(ctx, [[], [], []])
        decide(ctx.session, a, "approve", "좋음")
        decide(ctx.session, b, "reject")
        decide(ctx.session, c, "hold")
        with pytest.raises(ValueError):
            decide(ctx.session, a, "publish")
    with RunContext("2026-11-25", settings) as ctx:  # 새 세션에서도 반영 확인
        st = {s.id: s.approval_status for s in ctx.session.query(Script)}
        assert st == {a: "approved", b: "rejected", c: "on_hold"}
        assert ctx.session.get(Script, a).reviewer_note == "좋음"


def test_edit_creates_new_version(settings):
    with RunContext("2026-11-25", settings) as ctx:
        (a,) = _seed(ctx, [[]])
        old = ctx.session.get(Script, a)
        new_json = {**old.json, "scenes": [{**old.json["scenes"][0], "narration": "고친 문장입니다 여러분 반가워요"}]}
        new = edit_script(ctx.session, a, new_json, 5.0)
        assert new.version == 2 and new.approval_status == "pending_review" and new.char_count == 14
        assert ctx.session.get(Script, a).approval_status == "superseded"
        cands = candidates(ctx.session, "2026-11-25")
        assert [s.id for _, s in cands] == [new.id]


def test_auto_approve_skips_blocking_flags(settings):
    with RunContext("2026-11-25", settings) as ctx:
        a, b, c, d = _seed(ctx, [[], ["defamation"], ["unsupported"], []])
        approved = auto_approve(ctx.session, "2026-11-25", 2)
        assert [s.id for s in approved] == [a, c]
        assert ctx.session.get(Script, b).approval_status == "pending_review"
        md = render_shortlist(ctx.session, "2026-11-25")
        assert "⚠️" in md and "주제1" in md


def test_notify_without_webhooks_logs_only(monkeypatch):
    monkeypatch.delenv("SLACK_WEBHOOK_URL", raising=False)
    monkeypatch.delenv("TELEGRAM_BOT_TOKEN", raising=False)
    assert notify("hello") is False
    assert notify("hello", enabled=False) is False


def test_notify_slack(monkeypatch):
    sent = {}
    monkeypatch.setenv("SLACK_WEBHOOK_URL", "https://hooks.example/x")
    monkeypatch.delenv("TELEGRAM_BOT_TOKEN", raising=False)

    class R:
        def raise_for_status(self):
            pass

    def fake_post(url, json, timeout):
        sent.update(url=url, json=json)
        return R()

    monkeypatch.setattr("agent.notify.httpx.post", fake_post)
    assert notify("오늘의 후보 3개") is True
    assert sent["json"] == {"text": "오늘의 후보 3개"}
