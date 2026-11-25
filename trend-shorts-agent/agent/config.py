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
    daily_quota: int = 10_000
    quota_stop_ratio: float = 0.8


class LLMCfg(BaseModel):
    model: str = "claude-opus-5-5"
    effort: str = "medium"
    max_tokens: int = 16000
    fallbacks: str | None = "default"
    max_retries: int = 3
    price_per_mtok: dict[str, float] = Field(default_factory=lambda: {"input": 4.0, "output": 20.0})
    web_search_price_per_1k: float = 10.0


class ResearchCfg(BaseModel):
    provider: Literal["claude", "tavily", "serper"] = "claude"
    searches_per_topic: int = 4
    min_sources: int = 2


class TopicsCfg(BaseModel):
    max_topics_per_day: int = 10
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


class ProductionCfg(BaseModel):
    resolution: tuple[int, int] = (1080, 1920)
    fps: int = 30
    tts_provider: str = "elevenlabs"
    voice_id: str = ""
    elevenlabs_model: str = "eleven_multilingual_v2"
    visual_sources: list[str] = Field(
        default_factory=lambda: ["commons", "pexels_video", "pixabay_video", "pexels", "pixabay"])
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


class Settings(BaseModel):
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


def load_settings(path: str | Path | None = None, overrides: dict[str, Any] | None = None) -> Settings:
    load_dotenv(PROJECT_ROOT / ".env")
    path = Path(path or os.environ.get("AGENT_SETTINGS", CONFIG_DIR / "settings.yaml"))
    raw = yaml.safe_load(path.read_text(encoding="utf-8")) if path.exists() else {}
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
