"""DB 모델 (SQLAlchemy 2.0). SQLite 기본, db_url 로 Postgres 교체 가능."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import (
    JSON, Column, DateTime, Float, ForeignKey, Integer, String, Table, Text, UniqueConstraint, create_engine,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, relationship, sessionmaker


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


# 상태 흐름
RUN_STEPS = ["collected", "clustered", "researched", "scripted", "checked", "pending_review"]
APPROVAL_STATES = ["pending_review", "approved", "rejected", "on_hold"]
PRODUCTION_STATES = ["producing", "produced", "failed", "uploaded"]


topic_videos = Table(
    "topic_videos",
    Base.metadata,
    Column("topic_id", ForeignKey("topics.id", ondelete="CASCADE"), primary_key=True),
    Column("video_id", ForeignKey("videos.video_id", ondelete="CASCADE"), primary_key=True),
)


class Run(Base):
    __tablename__ = "runs"
    id: Mapped[int] = mapped_column(primary_key=True)
    date: Mapped[str] = mapped_column(String(10), unique=True, index=True)  # YYYY-MM-DD
    status: Mapped[str] = mapped_column(String(32), default="started")
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    quota_used: Mapped[int] = mapped_column(Integer, default=0)
    cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    usage: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)  # 토큰·TTS 글자수·API 호출 수
    error: Mapped[str | None] = mapped_column(Text, nullable=True)

    topics: Mapped[list["Topic"]] = relationship(back_populates="run", cascade="all, delete-orphan")


class Video(Base):
    __tablename__ = "videos"
    video_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    title: Mapped[str] = mapped_column(Text)
    channel: Mapped[str] = mapped_column(String(255), default="")
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    view_count: Mapped[int] = mapped_column(Integer, default=0)
    like_count: Mapped[int] = mapped_column(Integer, default=0)
    comment_count: Mapped[int] = mapped_column(Integer, default=0)
    duration_sec: Mapped[int] = mapped_column(Integer, default=0)
    views_per_hour: Mapped[float] = mapped_column(Float, default=0.0)
    tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    description: Mapped[str] = mapped_column(Text, default="")
    collected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    run_date: Mapped[str] = mapped_column(String(10), index=True, default="")


class Topic(Base):
    __tablename__ = "topics"
    id: Mapped[int] = mapped_column(primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("runs.id", ondelete="CASCADE"), index=True)
    key: Mapped[str] = mapped_column(String(64))  # topics.json 의 topic_id
    title: Mapped[str] = mapped_column(Text)
    summary: Mapped[str] = mapped_column(Text, default="")
    score: Mapped[float] = mapped_column(Float, default=0.0)
    fitness: Mapped[int] = mapped_column(Integer, default=3)
    angle_ideas: Mapped[list[str]] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(32), default="clustered")
    research: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    confidence: Mapped[str | None] = mapped_column(String(16), nullable=True)

    run: Mapped[Run] = relationship(back_populates="topics")
    videos: Mapped[list[Video]] = relationship(secondary=topic_videos)
    scripts: Mapped[list["Script"]] = relationship(back_populates="topic", cascade="all, delete-orphan")

    __table_args__ = (UniqueConstraint("run_id", "key"),)


class Script(Base):
    __tablename__ = "scripts"
    id: Mapped[int] = mapped_column(primary_key=True)
    topic_id: Mapped[int] = mapped_column(ForeignKey("topics.id", ondelete="CASCADE"), index=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    json: Mapped[dict[str, Any]] = mapped_column(JSON)
    char_count: Mapped[int] = mapped_column(Integer, default=0)
    est_seconds: Mapped[float] = mapped_column(Float, default=0.0)
    risk_flags: Mapped[list[str]] = mapped_column(JSON, default=list)
    approval_status: Mapped[str] = mapped_column(String(32), default="scripted")
    reviewer_note: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    topic: Mapped[Topic] = relationship(back_populates="scripts")
    productions: Mapped[list["Production"]] = relationship(back_populates="script", cascade="all, delete-orphan")


class Production(Base):
    __tablename__ = "productions"
    id: Mapped[int] = mapped_column(primary_key=True)
    script_id: Mapped[int] = mapped_column(ForeignKey("scripts.id", ondelete="CASCADE"), index=True)
    status: Mapped[str] = mapped_column(String(32), default="producing")
    video_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration: Mapped[float | None] = mapped_column(Float, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    youtube_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    script: Mapped[Script] = relationship(back_populates="productions")


class BgmSeed(Base):
    """같은 시드/곡 반복 방지 기록."""
    __tablename__ = "bgm_history"
    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(128), index=True)  # "seed:<n>" 또는 "track:<path>"
    used_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


# ---------------------------------------------------------------- 세션
_engines: dict[str, Any] = {}


def get_sessionmaker(db_url: str) -> sessionmaker[Session]:
    if db_url not in _engines:
        if db_url.startswith("sqlite:///"):
            from pathlib import Path
            Path(db_url.removeprefix("sqlite:///")).parent.mkdir(parents=True, exist_ok=True)
        engine = create_engine(db_url, future=True, json_serializer=lambda o: json.dumps(o, ensure_ascii=False))
        Base.metadata.create_all(engine)
        _engines[db_url] = sessionmaker(engine, expire_on_commit=False)
    return _engines[db_url]


def session_scope(db_url: str) -> Session:
    return get_sessionmaker(db_url)()
