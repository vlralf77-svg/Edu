"""Slack / Telegram 웹훅 알림 (설정·키가 없으면 로그만 남김)."""
from __future__ import annotations

import logging

import httpx

from .config import env

log = logging.getLogger(__name__)


def notify(text: str, enabled: bool = True) -> bool:
    if not enabled:
        log.info("[알림 비활성] %s", text)
        return False
    sent = False
    try:
        if url := env("SLACK_WEBHOOK_URL"):
            httpx.post(url, json={"text": text}, timeout=10).raise_for_status()
            sent = True
        token, chat = env("TELEGRAM_BOT_TOKEN"), env("TELEGRAM_CHAT_ID")
        if token and chat:
            httpx.post(f"https://api.telegram.org/bot{token}/sendMessage",
                       json={"chat_id": chat, "text": text}, timeout=10).raise_for_status()
            sent = True
    except httpx.HTTPError as e:  # 알림 실패가 파이프라인을 멈추지 않게
        log.warning("알림 전송 실패: %s", e)
    if not sent:
        log.info("[알림] %s", text)
    return sent
