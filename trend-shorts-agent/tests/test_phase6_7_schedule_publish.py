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

    assert daily_job(settings, run_fn=boom) is None
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
