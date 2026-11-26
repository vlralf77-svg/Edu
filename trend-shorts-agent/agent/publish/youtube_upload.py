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
SCOPES = ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube.readonly"]


def _abs(p: str) -> Path:
    from ..config import PROJECT_ROOT
    path = Path(p)
    return path if path.is_absolute() else PROJECT_ROOT / path


def client_secret_path() -> Path:
    return _abs(env("YOUTUBE_OAUTH_CLIENT_SECRETS", "config/client_secret.json"))


def token_path() -> Path:
    return _abs(env("YOUTUBE_OAUTH_TOKEN", "data/youtube_token.json"))


def login() -> str:
    """구글 계정 연결 후 업로드될 채널 이름 반환."""
    from googleapiclient.discovery import build
    creds = _credentials()
    yt = build("youtube", "v3", credentials=creds)
    items = yt.channels().list(part="snippet", mine=True).execute().get("items", [])
    if not items:
        raise RuntimeError("이 구글 계정에 YouTube 채널이 없습니다. YouTube 에서 채널을 먼저 만들어 주세요.")
    return items[0]["snippet"]["title"]


def build_body(meta: dict, privacy: str = "private") -> dict:
    tags = [h.lstrip("#") for h in meta.get("hashtags", [])][:15]
    title = meta.get("title", "")[:95]
    if "#shorts" not in title.lower() and len(title) < 88:
        title += " #shorts"
    return {
        "snippet": {"title": title, "description": meta.get("description", "")[:4900], "tags": tags,
                    "categoryId": "27" if meta.get("made_for_kids") else "25", "defaultLanguage": "ko", "defaultAudioLanguage": "ko"},
        "status": {
            "privacyStatus": privacy,
            "selfDeclaredMadeForKids": bool(meta.get("made_for_kids", False)),
            # 변경되거나 합성된 콘텐츠(AI) 공개
            "containsSyntheticMedia": bool(meta.get("synthetic_media", True)),
        },
    }


def _credentials():
    from ..tools import ensure_package
    ensure_package("google-api-python-client google-auth-oauthlib", "googleapiclient")
    ensure_package("google-auth-oauthlib", "google_auth_oauthlib")
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    token = token_path()
    creds = Credentials.from_authorized_user_file(str(token), SCOPES) if token.exists() else None
    if creds and creds.expired and creds.refresh_token:
        try:
            creds.refresh(Request())
        except Exception:  # noqa: BLE001  토큰이 만료·취소됨 → 다시 로그인
            creds = None
    if not creds or not creds.valid:
        secret = client_secret_path()
        if not secret.exists():
            raise RuntimeError("YouTube 업로드용 OAuth 파일(client_secret.json)이 없습니다. "
                               "제어판 ⚙️ 설정 ▸ YouTube 업로드 에서 파일을 올려 주세요.")
        flow = InstalledAppFlow.from_client_secrets_file(str(secret), SCOPES)
        log.warning("브라우저에서 구글 계정 로그인 창이 열립니다. 업로드할 채널의 계정으로 허용해 주세요.")
        creds = flow.run_local_server(port=0, open_browser=True)
        token.parent.mkdir(parents=True, exist_ok=True)
        token.write_text(creds.to_json(), encoding="utf-8")
    return creds


def upload(video_path: Path, meta_path: Path, privacy: str = "private") -> str:
    creds = _credentials()
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaFileUpload

    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    yt = build("youtube", "v3", credentials=creds)
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
