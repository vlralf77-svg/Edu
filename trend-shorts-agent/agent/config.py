"""설정 로더: config/settings.yaml + .env → 검증된 Settings 객체."""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Any, Literal

import yaml
from dotenv import load_dotenv
from pydantic import BaseModel, Field

PROJECT_ROOT = Path(__file__).resolve().parent.parent
CONFIG_DIR = PROJECT_ROOT / "config"
PROMPTS_DIR = CONFIG_DIR / "prompts"


class ScheduleCfg(BaseModel):
    timezone: str = "Asia/Seoul"
    run_at: str = "07:00"
    retry_count: int = 2          # 자동 실행이 실패하면 다시 시도할 횟수
    retry_wait_min: int = 20      # 재시도 전 대기(분)


class CollectCfg(BaseModel):
    region_code: str = "KR"
    relevance_language: str = "ko"
    published_within_hours: int = 48
    min_view_count: int = 100_000
    max_videos: int = 50
    include_shorts: bool = True
    category_ids: list[int] = Field(default_factory=list)
    search_queries: list[str] = Field(default_factory=list)
    exclude_keywords: list[str] = Field(default_factory=list)
    dedupe_days: int = 7
    safe_search: str = ""               # strict: 어린이용 수집
    include_keywords: list[str] = Field(default_factory=list)  # 비어 있지 않으면 이 단어가 하나라도 있는 영상만
    search_with_categories: bool = True # False 면 search.list 를 카테고리별로 곱하지 않음 (쿼터 절약)
    daily_quota: int = 10_000
    quota_stop_ratio: float = 0.8


class LLMCfg(BaseModel):
    provider: Literal["gemini", "groq", "openrouter", "claude"] = "gemini"
    groq_model: str = "llama-3.3-70b-versatile"
    openrouter_model: str = "meta-llama/llama-3.3-70b-instruct:free"
    gemini_model: str = "gemini-flash-latest"   # 구글이 관리하는 '최신 flash' 별칭
    gemini_min_interval_sec: float = 13.0
    gemini_retries: int = 4                     # 같은 모델 재시도 횟수 (5→10→20→40초…최대 60초 간격)
    gemini_fallback_models: list[str] = Field(default_factory=lambda: ["gemini-flash-latest", "gemini-flash-lite-latest"])
    gemini_price_per_mtok: dict[str, float] = Field(default_factory=lambda: {"input": 0.0, "output": 0.0})
    model: str = "claude-opus-5-5"
    effort: str = "medium"
    max_tokens: int = 16000
    fallbacks: str | None = "default"
    max_retries: int = 3
    price_per_mtok: dict[str, float] = Field(default_factory=lambda: {"input": 4.0, "output": 20.0})
    web_search_price_per_1k: float = 10.0


class ResearchCfg(BaseModel):
    provider: Literal["auto", "news", "llm", "claude", "tavily", "serper"] = "auto"
    # auto: Gemini 면 news(구글 뉴스 RSS, 무료·키 불필요), Claude 면 llm(내장 웹 검색)
    searches_per_topic: int = 3
    min_sources: int = 2


class TopicsCfg(BaseModel):
    max_topics_per_day: int = 3
    min_videos_per_topic: int = 1
    weights: dict[str, float] = Field(
        default_factory=lambda: {"total_views": 0.35, "views_per_hour": 0.35, "video_count": 0.1, "fitness": 0.2}
    )


class ScriptCfg(BaseModel):
    max_seconds: int = 60
    target_chars_ko: int = 300
    chars_per_second: float = 5.2
    max_rewrites: int = 2
    tone: str = "친근하고 빠른 뉴스 브리핑"
    structure: list[str] = Field(default_factory=lambda: ["hook", "context", "key_points", "closing"])
    # 마지막 장면 행동 유도 (구독·좋아요). style: direct(구독·좋아요 요청) | soft(인사만) | none
    cta_style: str = "direct"
    cta_text: str = "도움이 됐다면 좋아요와 구독 부탁드려요!"
    cta_soft_text: str = "오늘 이야기 재미있었나요? 다음에 또 신기한 이야기로 만나요!"


class ProductionCfg(BaseModel):
    resolution: tuple[int, int] = (1080, 1920)
    fps: int = 30
    tts_provider: str = "elevenlabs"
    voice_id: str = ""
    elevenlabs_model: str = "eleven_multilingual_v2"
    edge_voice: str = "ko-KR-SunHiNeural"
    style: str = "classic"   # 화면 스타일: classic(기본) | dynamic(요즘 숏츠: 상단 제목 띠·큰 단어 자막·흔들림·효과음·진행 막대) | cartoon
    visual_sources: list[str] = Field(
        default_factory=lambda: ["wiki_lead", "commons", "pixabay_video", "pexels_video", "pixabay", "pexels"])
    commons_max_per_subject: int = 2
    max_clip_mb: float = 80
    burn_subtitles: bool = True
    subtitle_max_chars: int = 14
    font_path: str = ""
    max_tts_speed: float = 1.15


class BgmCfg(BaseModel):
    mode: Literal["generate", "library", "hybrid"] = "generate"
    volume: float = 0.08
    sad_volume: float = 0.05
    sad_disable: bool = False
    ducking_db: float = -12
    fade_in_sec: float = 0.5
    fade_out_sec: float = 1.5
    soundfont: str = "assets/soundfonts/FluidR3_GM.sf2"
    library_dir: str = "assets/bgm/library"
    avoid_repeat_days: int = 7


class ReviewCfg(BaseModel):
    require_approval: bool = True
    auto_produce_top_n: int = 3


class NotifyCfg(BaseModel):
    enabled: bool = False


class PublishCfg(BaseModel):
    enabled: bool = False
    privacy: str = "private"


class BudgetCfg(BaseModel):
    max_daily_cost_usd: float = 5.0


class PathsCfg(BaseModel):
    data_dir: str = "data"
    db_url: str = ""


class KidsCfg(BaseModel):
    """🧒 어린이용 영상 실행에 덮어쓸 값 (실행 이름에 'kids' 가 들어가면 적용)."""
    category_ids: list[int] = Field(default_factory=lambda: [15, 27, 28, 1])  # 동물·교육·과학기술·애니메이션
    search_queries: list[str] = Field(default_factory=lambda: [
        "어린이 과학", "신기한 동물", "공룡", "우주 이야기", "과학 실험"])
    min_view_count: int = 10_000
    published_within_hours: int = 168
    exclude_keywords: list[str] = Field(default_factory=lambda: [
        "사고", "사망", "살인", "폭행", "범죄", "전쟁", "공포", "귀신", "괴담", "성인", "도박", "술", "담배",
        "다이어트", "연애", "논란", "정치", "선거", "주식", "코인"])
    target_chars_ko: int = 240
    chars_per_second: float = 4.6
    tone: str = "5~10살 어린이에게 말하듯 다정하고 신나는 말투"
    cta_style: str = "soft"            # soft(기본) | direct | none — 어린이 대상 구독 유도는 YouTube 품질 기준상 주의
    edge_voice: str = "ko-KR-SunHiNeural"
    style: str = "classic"   # classic | cartoon(만화 스타일: 애니메이션 클립·일러스트·만화 필터·말풍선 자막)
    allowed_moods: list[str] = Field(default_factory=lambda: ["funny", "calm", "upbeat", "inspiring", "tech"])


class SoccerCfg(BaseModel):
    """⚽ 축구 영상 실행에 덮어쓸 값 (실행 이름에 'soccer' 가 들어가면 적용)."""
    category_ids: list[int] = Field(default_factory=lambda: [17])  # 스포츠
    search_queries: list[str] = Field(default_factory=lambda: [
        "축구", "손흥민", "K리그", "프리미어리그", "챔피언스리그", "축구 국가대표"])
    include_keywords: list[str] = Field(default_factory=lambda: [
        "축구", "K리그", "득점", "골키퍼", "손흥민", "이강인", "김민재", "황희찬", "국대", "국가대표", "월드컵", "EPL", "프리미어",
        "챔스", "챔피언스", "라리가", "분데스", "세리에", "해트트릭", "이적", "토트넘", "맨시티", "맨유", "리버풀",
        "아스널", "첼시", "레알", "바르셀로나", "바르사", "PSG", "뮌헨", "soccer", "football", "FIFA", "AFC"])
    exclude_keywords: list[str] = Field(default_factory=lambda: ["토토", "배팅", "베팅", "사설", "먹튀", "중계 링크", "무료 중계"])
    min_view_count: int = 30_000
    published_within_hours: int = 48
    tone: str = "열정적인 스포츠 캐스터처럼 빠르고 생생한 말투"
    allowed_moods: list[str] = Field(default_factory=lambda: ["upbeat", "inspiring", "tense", "tech"])
    youtube_category: str = "17"
    style: str = "dynamic"   # 요즘 축구 숏츠 형식
    target_chars_ko: int = 200   # 약 35~40초 (짧고 빠르게)


class Settings(BaseModel):
    profile: str = "general"   # general | kids | soccer (실행마다 자동 결정)
    kids: KidsCfg = KidsCfg()
    soccer: SoccerCfg = SoccerCfg()
    schedule: ScheduleCfg = ScheduleCfg()
    collect: CollectCfg = CollectCfg()
    llm: LLMCfg = LLMCfg()
    research: ResearchCfg = ResearchCfg()
    topics: TopicsCfg = TopicsCfg()
    script: ScriptCfg = ScriptCfg()
    production: ProductionCfg = ProductionCfg()
    bgm: BgmCfg = BgmCfg()
    review: ReviewCfg = ReviewCfg()
    notify: NotifyCfg = NotifyCfg()
    publish: PublishCfg = PublishCfg()
    budget: BudgetCfg = BudgetCfg()
    paths: PathsCfg = PathsCfg()

    # ---- 경로 헬퍼 ----
    @property
    def data_dir(self) -> Path:
        p = Path(self.paths.data_dir)
        return p if p.is_absolute() else PROJECT_ROOT / p

    @property
    def db_url(self) -> str:
        return self.paths.db_url or f"sqlite:///{self.data_dir / 'agent.db'}"

    def run_dir(self, run_date: str) -> Path:
        d = self.data_dir / "runs" / run_date
        d.mkdir(parents=True, exist_ok=True)
        return d

    def resolve(self, rel: str) -> Path:
        p = Path(rel)
        return p if p.is_absolute() else PROJECT_ROOT / p


def _deep_merge(base: dict, override: dict) -> dict:
    out = dict(base)
    for k, v in override.items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _deep_merge(out[k], v)
        else:
            out[k] = v
    return out


LOCAL_SETTINGS = CONFIG_DIR / "settings.local.yaml"   # 화면(설정 탭)에서 바꾼 값. git 제외
ENV_FILE = PROJECT_ROOT / ".env"


def load_settings(path: str | Path | None = None, overrides: dict[str, Any] | None = None,
                  use_local: bool = True) -> Settings:
    load_dotenv(ENV_FILE, override=True)
    path = Path(path or os.environ.get("AGENT_SETTINGS", CONFIG_DIR / "settings.yaml"))
    raw = yaml.safe_load(path.read_text(encoding="utf-8")) if path.exists() else {}
    if use_local and "AGENT_SETTINGS" not in os.environ and LOCAL_SETTINGS.exists():
        raw = _deep_merge(raw or {}, yaml.safe_load(LOCAL_SETTINGS.read_text(encoding="utf-8")) or {})
    if overrides:
        raw = _deep_merge(raw or {}, overrides)
    return Settings.model_validate(raw or {})


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return load_settings()


def load_prompt(name: str, **kwargs: Any) -> str:
    """config/prompts/{name}.md 를 읽고 {placeholder} 를 치환한다 (JSON 중괄호는 건드리지 않음)."""
    text = (PROMPTS_DIR / f"{name}.md").read_text(encoding="utf-8")
    for k, v in kwargs.items():
        text = text.replace("{" + k + "}", str(v))
    return text


def env(name: str, default: str = "") -> str:
    return os.environ.get(name, default)


# ---------------------------------------------------------------- 화면에서 저장
def save_local_settings(updates: dict[str, Any], path: Path | None = None) -> Path:
    """settings.yaml(주석 포함 원본)은 건드리지 않고 settings.local.yaml 에 덮어쓸 값만 저장."""
    path = path or LOCAL_SETTINGS
    current = yaml.safe_load(path.read_text(encoding="utf-8")) if path.exists() else {}
    merged = _deep_merge(current or {}, updates)
    path.write_text(yaml.safe_dump(merged, allow_unicode=True, sort_keys=False), encoding="utf-8")
    get_settings.cache_clear()
    return path


def read_env(path: Path | None = None) -> dict[str, str]:
    path = path or ENV_FILE
    out: dict[str, str] = {}
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                k, v = line.split("=", 1)
                out[k.strip()] = v.split("#", 1)[0].strip() if v.strip().startswith(("#", " ")) else v.strip()
    return out


def save_env(updates: dict[str, str], path: Path | None = None) -> Path:
    """.env 의 해당 키만 갱신 (다른 줄·주석 유지). 빈 값은 무시해서 실수로 키가 지워지지 않게."""
    path = path or ENV_FILE
    updates = {k: v.strip() for k, v in updates.items() if v and v.strip()}
    if not path.exists():
        example = PROJECT_ROOT / ".env.example"
        path.write_text(example.read_text(encoding="utf-8") if example.exists() else "", encoding="utf-8")
    lines = path.read_text(encoding="utf-8").splitlines()
    done = set()
    for i, line in enumerate(lines):
        key = line.split("=", 1)[0].strip()
        if "=" in line and not line.lstrip().startswith("#") and key in updates:
            lines[i] = f"{key}={updates[key]}"
            done.add(key)
    lines += [f"{k}={v}" for k, v in updates.items() if k not in done]
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    for k, v in updates.items():
        os.environ[k] = v
    get_settings.cache_clear()
    return path


def apply_profile(settings: Settings, profile: str) -> Settings:
    """어린이용·축구 실행이면 수집·대본·음성 설정을 그 분야용으로 바꾼 복사본."""
    if profile == "soccer":
        s = settings.model_copy(deep=True)
        c = s.soccer
        s.profile = "soccer"
        s.collect.category_ids = list(c.category_ids)
        s.collect.search_queries = list(c.search_queries)
        s.collect.include_keywords = list(c.include_keywords)
        s.collect.exclude_keywords = list(dict.fromkeys(s.collect.exclude_keywords + c.exclude_keywords))
        s.collect.min_view_count = c.min_view_count
        s.collect.published_within_hours = c.published_within_hours
        s.collect.search_with_categories = False
        s.script.tone = c.tone
        s.script.target_chars_ko = c.target_chars_ko
        s.production.style = c.style
        return s
    if profile != "kids":
        return settings
    s = settings.model_copy(deep=True)
    k = s.kids
    s.profile = "kids"
    s.collect.category_ids = list(k.category_ids)
    s.collect.search_queries = list(k.search_queries)
    s.collect.min_view_count = k.min_view_count
    s.collect.published_within_hours = k.published_within_hours
    s.collect.exclude_keywords = list(dict.fromkeys(s.collect.exclude_keywords + k.exclude_keywords))
    s.collect.safe_search = "strict"
    s.collect.search_with_categories = False
    s.script.target_chars_ko = k.target_chars_ko
    s.script.chars_per_second = k.chars_per_second
    s.script.tone = k.tone
    s.script.cta_style = k.cta_style
    s.production.edge_voice = k.edge_voice
    s.production.style = k.style
    if k.style == "cartoon":  # 만화 클립·일러스트를 먼저 찾고, 없으면 실사 영상에 만화 필터
        s.production.visual_sources = ["pixabay_video_anim", "pixabay_illust", "wiki_lead", "commons", "pixabay_video",
                                       "pexels_video", "pixabay", "pexels"]
    return s


PROFILES = {"general": ("", "일반"), "kids": ("🧒", "어린이용"), "soccer": ("⚽", "축구")}


def profile_of(run_name: str) -> str:
    n = run_name or ""
    return "kids" if "kids" in n else "soccer" if "soccer" in n else "general"


def profile_label(run_name: str) -> str:
    icon, name = PROFILES[profile_of(run_name)]
    return f"{icon} {name}".strip() + (" · 📰 기사" if "-url" in (run_name or "") else "")


def allowed_moods(settings: Settings) -> list[str] | None:
    return {"kids": settings.kids.allowed_moods, "soccer": settings.soccer.allowed_moods}.get(settings.profile)


def youtube_category(settings: Settings) -> str:
    return {"kids": "27", "soccer": settings.soccer.youtube_category}.get(settings.profile, "25")
