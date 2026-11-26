"""Phase 6: 락 파일·하루 1회 보장·실패 알림 / Phase 7: 업로드 요청 바디."""
import threading

import pytest

from agent.publish.youtube_upload import build_body
from agent.scheduler import AlreadyRunning, crontab_line, daily_job, done_marker, file_lock


def test_daily_job_runs_once_per_day(settings):
    calls = []
    assert daily_job(settings, run_fn=lambda d, settings: calls.append(d)) is not None
    assert daily_job(settings, run_fn=lambda d, settings: calls.append(d)) is None
    assert len(calls) == 1


def test_lock_prevents_concurrent_runs(settings):
    lock = settings.data_dir / "daily.lock"
    with file_lock(lock):
        with pytest.raises(AlreadyRunning):
            with file_lock(lock):
                pass
        # 락이 잡힌 동안의 daily_job 은 실행하지 않음
        result = []
        t = threading.Thread(target=lambda: result.append(daily_job(settings, run_fn=lambda d, settings: None)))
        t.start()
        t.join()
        assert result == [None]


def test_failure_notifies_and_allows_retry(settings, monkeypatch):
    sent = []
    monkeypatch.setattr("agent.scheduler.notify", lambda text, enabled=True: sent.append(text))

    def boom(d, settings):
        raise RuntimeError("API down")

    assert daily_job(settings, run_fn=boom, sleep=lambda s: None) is None
    assert sent and "API down" in sent[0]
    from agent.context import today
    assert not done_marker(settings, today(settings)).exists()  # 실패 시 마커 없음 → 재시도 가능
    assert daily_job(settings, run_fn=lambda d, settings: None) is not None


def test_crontab_line(settings, tmp_path):
    line = crontab_line(settings, tmp_path)
    assert "CRON_TZ=Asia/Seoul" in line and line.splitlines()[1].startswith("0 7 * * *")


def test_upload_body_private_and_synthetic():
    body = build_body({"title": "제목", "description": "설명", "hashtags": ["#AI", "#뉴스"], "synthetic_media": True})
    assert body["status"]["privacyStatus"] == "private"
    assert body["status"]["containsSyntheticMedia"] is True
    assert body["snippet"]["tags"] == ["AI", "뉴스"] and body["snippet"]["title"].endswith("#shorts")


def test_daily_job_retries_transient_failure(settings):
    calls, waits = [], []

    def flaky(d, settings):
        calls.append(d)
        if len(calls) < 3:
            raise RuntimeError("503 high demand")

    assert daily_job(settings, run_fn=flaky, sleep=waits.append) is not None
    assert len(calls) == 3 and waits == [20 * 60, 20 * 60]


def test_publish_cli_uploads_and_records(settings, monkeypatch, tmp_path):
    from typer.testing import CliRunner
    from agent.__main__ import app
    from agent.context import RunContext
    from agent.models import Production, Script, Topic
    vid = tmp_path / "final.mp4"
    vid.write_bytes(b"x")
    (tmp_path / "meta.json").write_text('{"title": "t"}', encoding="utf-8")
    with RunContext("2026-11-25", settings) as ctx:
        t = Topic(run_id=ctx.run.id, key="k", title="t")
        ctx.session.add(t)
        ctx.session.flush()
        s = Script(topic_id=t.id, json={}, approval_status="produced")
        ctx.session.add(s)
        ctx.session.flush()
        p = Production(script_id=s.id, status="produced", video_path=str(vid))
        ctx.session.add(p)
        ctx.session.commit()
        pid = p.id
    calls = []
    monkeypatch.setattr("agent.__main__.get_settings", lambda: settings)
    monkeypatch.setattr("agent.publish.youtube_upload.upload",
                        lambda v, m, privacy: calls.append((v, privacy)) or "YTID123")
    res = CliRunner().invoke(app, ["publish", "--production-id", str(pid)])
    assert res.exit_code == 0, res.output
    assert "YTID123" in res.output and calls[0][1] == "private"
    with RunContext("2026-11-25", settings) as ctx:
        p = ctx.session.get(Production, pid)
        assert p.status == "uploaded" and p.youtube_id == "YTID123"


def test_login_without_oauth_file_explains(monkeypatch, tmp_path):
    from agent.publish import youtube_upload as yu
    monkeypatch.setattr(yu, "client_secret_path", lambda: tmp_path / "none.json")
    monkeypatch.setattr(yu, "token_path", lambda: tmp_path / "token.json")
    monkeypatch.setattr("agent.tools.ensure_package", lambda *a: None)
    try:
        import google_auth_oauthlib  # noqa: F401
    except ImportError:
        import pytest
        pytest.skip("google 패키지 미설치 환경")
    import pytest
    with pytest.raises(RuntimeError, match="OAuth 파일"):
        yu._credentials()
