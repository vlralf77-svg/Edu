"""(선택) YouTube 업로드: OAuth 2.0 + videos.insert, 기본 비공개. 사람이 확인 후 공개 전환한다.

필요 패키지: pip install -e ".[publish]"
OAuth 클라이언트 JSON: Google Cloud Console → YouTube Data API v3 → OAuth 클라이언트(데스크톱) → config/client_secret.json
"""
from __future__ import annotations

import json
import logging
from pathlib import Path

from ..config import env

log = logging.getLogger(__name__)
SCOPES = ["https://www.googleapis.com/auth/youtube.upload"]


def build_body(meta: dict, privacy: str = "private") -> dict:
    tags = [h.lstrip("#") for h in meta.get("hashtags", [])][:15]
    title = meta.get("title", "")[:95]
    if "#shorts" not in title.lower() and len(title) < 88:
        title += " #shorts"
    return {
        "snippet": {"title": title, "description": meta.get("description", "")[:4900], "tags": tags,
                    "categoryId": "25", "defaultLanguage": "ko", "defaultAudioLanguage": "ko"},
        "status": {
            "privacyStatus": privacy,
            "selfDeclaredMadeForKids": bool(meta.get("made_for_kids", False)),
            # 변경되거나 합성된 콘텐츠(AI) 공개
            "containsSyntheticMedia": bool(meta.get("synthetic_media", True)),
        },
    }


def _credentials():
    try:
        from google.auth.transport.requests import Request
        from google.oauth2.credentials import Credentials
        from google_auth_oauthlib.flow import InstalledAppFlow
    except ImportError as e:
        raise RuntimeError('업로드에는 pip install -e ".[publish]" 가 필요합니다') from e
    token = Path(env("YOUTUBE_OAUTH_TOKEN", "data/youtube_token.json"))
    creds = Credentials.from_authorized_user_file(str(token), SCOPES) if token.exists() else None
    if creds and creds.expired and creds.refresh_token:
        creds.refresh(Request())
    if not creds or not creds.valid:
        flow = InstalledAppFlow.from_client_secrets_file(env("YOUTUBE_OAUTH_CLIENT_SECRETS",
                                                             "config/client_secret.json"), SCOPES)
        creds = flow.run_local_server(port=0)
        token.parent.mkdir(parents=True, exist_ok=True)
        token.write_text(creds.to_json(), encoding="utf-8")
    return creds


def upload(video_path: Path, meta_path: Path, privacy: str = "private") -> str:
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaFileUpload

    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    yt = build("youtube", "v3", credentials=_credentials())
    req = yt.videos().insert(part="snippet,status", body=build_body(meta, privacy),
                             media_body=MediaFileUpload(str(video_path), chunksize=-1, resumable=True,
                                                        mimetype="video/mp4"))
    resp = None
    while resp is None:
        status, resp = req.next_chunk()
        if status:
            log.info("업로드 %d%%", int(status.progress() * 100))
    log.info("업로드 완료: https://youtu.be/%s (%s)", resp["id"], privacy)
    return resp["id"]
