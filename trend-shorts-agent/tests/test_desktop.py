"""서버 없이 PC 프로그램으로 쓰기: 내장 신시사이저, 설정/키 저장, 예약 작업, 작업 실행기, 환경 점검."""
import time
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import numpy as np
import soundfile as sf
import yaml

from agent import config as cfg
from agent.doctor import ready, run_checks
from agent.production.bgm import generator
from agent.production.bgm.generator import compose, generate_bgm
from agent.production.bgm.synth import render_numpy
from agent.scheduler import (
    CRON_BEGIN, crontab_block, daily_job, done_marker, is_due, merge_crontab, windows_commands, windows_job_bat,
)
from agent.ui import jobs


# ---------------------------------------------------------------- 내장 신시사이저
def test_builtin_synth_deterministic_and_clean():
    pm, _ = compose("upbeat", 10, 3)
    a, b = render_numpy(pm, 3), render_numpy(pm, 3)
    assert a.shape[1] == 2 and np.array_equal(a, b)
    assert np.sqrt(np.mean(a ** 2)) > 0.01


def test_generate_bgm_without_fluidsynth(tmp_path, monkeypatch):
    monkeypatch.setattr(generator.shutil, "which", lambda name: None)  # Windows 처럼 fluidsynth 없음
    path, meta = generate_bgm("news", 20, 9, tmp_path, Path("nope.sf2"))
    audio, sr = sf.read(str(path), always_2d=True)
    assert abs(len(audio) / sr - 20.5) <= 0.2 and np.max(np.abs(audio)) < 0.99
    assert meta["renderer"] == "builtin-synth"


# ---------------------------------------------------------------- 설정·키 저장
def test_save_env_updates_only_given_keys(tmp_path, monkeypatch):
    env = tmp_path / ".env"
    env.write_text("# 주석\nANTHROPIC_API_KEY=old\nYOUTUBE_API_KEY=\nOTHER=keep\n", encoding="utf-8")
    monkeypatch.delenv("YOUTUBE_API_KEY", raising=False)
    cfg.save_env({"ANTHROPIC_API_KEY": "", "YOUTUBE_API_KEY": " yt-123 ", "PEXELS_API_KEY": "px"}, env)
    text = env.read_text(encoding="utf-8")
    assert "ANTHROPIC_API_KEY=old" in text           # 빈 값은 기존 유지
    assert "YOUTUBE_API_KEY=yt-123" in text and "PEXELS_API_KEY=px" in text
    assert "# 주석" in text and "OTHER=keep" in text
    assert cfg.read_env(env)["YOUTUBE_API_KEY"] == "yt-123"
    import os
    assert os.environ["YOUTUBE_API_KEY"] == "yt-123"
    os.environ.pop("YOUTUBE_API_KEY", None)
    os.environ.pop("PEXELS_API_KEY", None)


def test_read_env_ignores_inline_comment_only_values(tmp_path):
    env = tmp_path / ".env"
    env.write_text("GOOGLE_APPLICATION_CREDENTIALS=   # 경로\nA=b\n", encoding="utf-8")
    assert cfg.read_env(env) == {"GOOGLE_APPLICATION_CREDENTIALS": "", "A": "b"}


def test_local_settings_override(tmp_path, monkeypatch):
    local = tmp_path / "settings.local.yaml"
    cfg.save_local_settings({"topics": {"max_topics_per_day": 2}, "llm": {"model": "claude-haiku-5-5"}}, local)
    cfg.save_local_settings({"budget": {"max_daily_cost_usd": 0.5}}, local)
    data = yaml.safe_load(local.read_text(encoding="utf-8"))
    assert data == {"topics": {"max_topics_per_day": 2}, "llm": {"model": "claude-haiku-5-5"},
                    "budget": {"max_daily_cost_usd": 0.5}}
    monkeypatch.setattr(cfg, "LOCAL_SETTINGS", local)
    monkeypatch.delenv("AGENT_SETTINGS", raising=False)
    s = cfg.load_settings()
    assert s.topics.max_topics_per_day == 2 and s.llm.model == "claude-haiku-5-5"
    assert s.topics.min_videos_per_topic == 1          # 나머지는 settings.yaml 값
    assert cfg.load_settings(use_local=False).topics.max_topics_per_day == 3


# ---------------------------------------------------------------- 예약 작업
def test_is_due_and_if_due(settings):
    tz = ZoneInfo("Asia/Seoul")
    assert not is_due(settings, datetime(2026, 11, 25, 6, 59, tzinfo=tz))
    assert is_due(settings, datetime(2026, 11, 25, 7, 0, tzinfo=tz))
    done_marker(settings, "2026-11-25").parent.mkdir(parents=True)
    done_marker(settings, "2026-11-25").write_text("ok")
    assert not is_due(settings, datetime(2026, 11, 25, 9, 0, tzinfo=tz))


def test_daily_job_if_due_skips_before_time(settings, monkeypatch):
    calls = []
    monkeypatch.setattr("agent.scheduler.is_due", lambda s: False)
    assert daily_job(settings, run_fn=lambda d, settings: calls.append(d), if_due=True) is None
    monkeypatch.setattr("agent.scheduler.is_due", lambda s: True)
    assert daily_job(settings, run_fn=lambda d, settings: calls.append(d), if_due=True) is not None
    assert len(calls) == 1


def test_merge_crontab_keeps_other_jobs():
    existing = "0 1 * * * backup.sh\n"
    block = f"{CRON_BEGIN}\n5 7 * * * x\n# <<< trend-shorts-agent <<<"
    once = merge_crontab(existing, block)
    twice = merge_crontab(once, block.replace("5 7", "9 8"))
    assert "backup.sh" in twice and "9 8 * * * x" in twice and "5 7" not in twice
    assert twice.count(CRON_BEGIN) == 1
    assert merge_crontab(twice, None).strip() == "0 1 * * * backup.sh"


def test_crontab_block_and_windows_commands(settings, tmp_path):
    block = crontab_block(settings, tmp_path, "/py")
    assert "daily-job" in block and "@reboot" in block and "--if-due" in block
    bat = windows_job_bat(Path(r"C:\Users\me\agent"), True)
    assert "--if-due" in bat and "\r\n" in bat and "chcp 65001" in bat
    cmd = windows_commands(settings, Path(r"C:\Users\me\agent\data\run.bat"))[0]
    assert cmd[:6] == ["schtasks", "/Create", "/F", "/SC", "DAILY", "/TN"] and "/ST" in cmd


# ---------------------------------------------------------------- 작업 실행기·점검
def test_job_runner_runs_cli_in_background(tmp_path):
    job = jobs.start("doctor", ["--help"], tmp_path)
    for _ in range(100):
        if jobs.current().returncode is not None:
            break
        time.sleep(0.1)
    assert jobs.current().returncode == 0
    assert "Usage" in jobs.tail(job.log, 500)
    assert jobs.last(tmp_path).name == "doctor"


def test_doctor_reports_missing_keys(settings, monkeypatch):
    for k in ("GEMINI_API_KEY", "YOUTUBE_API_KEY", "PEXELS_API_KEY", "PIXABAY_API_KEY", "ELEVENLABS_API_KEY"):
        monkeypatch.delenv(k, raising=False)
    checks = run_checks(settings)
    names = {c.name: c for c in checks}
    assert names["FFmpeg (영상 합성)"].ok and names["한글 폰트"].ok
    assert not names["Gemini API 키 (분석·대본, 무료)"].ok and not ready(checks)
    assert "Claude API 키 (분석·대본, 유료)" not in names       # 기본은 Gemini → Claude 키 불필요
    for k in ("GEMINI_API_KEY", "YOUTUBE_API_KEY", "PIXABAY_API_KEY", "ELEVENLABS_API_KEY"):  # Pexels 없이도 준비 완료
        monkeypatch.setenv(k, "x")
    settings.production.voice_id = "v"
    assert ready(run_checks(settings))
