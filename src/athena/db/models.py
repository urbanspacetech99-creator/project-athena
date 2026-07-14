from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, Index, Integer, String, Text, UniqueConstraint, text
from sqlalchemy.ext.mutable import MutableList
from sqlalchemy.orm import Mapped, mapped_column

from athena.db.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class _SourceRow:
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_id: Mapped[str] = mapped_column(String(128))
    window_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


class OwnPost(Base, _SourceRow):
    __tablename__ = "own_posts"
    __table_args__ = (UniqueConstraint("source_id", "window_date", name="uq_own_posts_source_window"),)
    platform: Mapped[str] = mapped_column(String(32))
    title: Mapped[str] = mapped_column(String(512), default="")
    content: Mapped[str] = mapped_column(Text, default="")
    views: Mapped[int] = mapped_column(Integer, default=0)
    likes: Mapped[int] = mapped_column(Integer, default=0)
    interactions: Mapped[int] = mapped_column(Integer, default=0)


class PostComment(Base, _SourceRow):
    __tablename__ = "post_comments"
    __table_args__ = (UniqueConstraint("source_id", name="uq_post_comments_source_id"),)
    post_source_id: Mapped[str] = mapped_column(String(128), index=True)
    text: Mapped[str] = mapped_column(Text, default="")


class CompetitorPost(Base, _SourceRow):
    __tablename__ = "competitor_posts"
    __table_args__ = (UniqueConstraint("source_id", name="uq_competitor_posts_source_id"),)
    competitor: Mapped[str] = mapped_column(String(128), index=True)
    text: Mapped[str] = mapped_column(Text, default="")
    platform: Mapped[str] = mapped_column(String(32), default="facebook")


class CompetitorComment(Base, _SourceRow):
    __tablename__ = "competitor_comments"
    __table_args__ = (UniqueConstraint("source_id", name="uq_competitor_comments_source_id"),)
    post_source_id: Mapped[str] = mapped_column(String(128), index=True)
    text: Mapped[str] = mapped_column(Text, default="")


class GoogleReview(Base, _SourceRow):
    __tablename__ = "google_reviews"
    __table_args__ = (UniqueConstraint("source_id", name="uq_google_reviews_source_id"),)
    star_rating: Mapped[int] = mapped_column(Integer, default=0)
    comment: Mapped[str] = mapped_column(Text, default="")
    reviewer: Mapped[str] = mapped_column(String(256), default="")


class KeywordVolume(Base, _SourceRow):
    __tablename__ = "keyword_volumes"
    __table_args__ = (UniqueConstraint("source_id", "window_date", name="uq_keyword_volumes_source_window"),)
    keyword: Mapped[str] = mapped_column(String(256), index=True)
    weekly_search_volume: Mapped[int] = mapped_column(Integer, default=0)


class ZohoChat(Base, _SourceRow):
    __tablename__ = "zoho_chats"
    __table_args__ = (UniqueConstraint("source_id", name="uq_zoho_chats_source_id"),)
    transcript: Mapped[str] = mapped_column(Text, default="")


class SavedDraft(Base):
    __tablename__ = "saved_drafts"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    platform: Mapped[str] = mapped_column(String(32))
    caption: Mapped[str] = mapped_column(Text, default="")
    image_url: Mapped[str] = mapped_column(String(1024), default="")
    image_b64: Mapped[str] = mapped_column(Text, default="")
    canva_edit_url: Mapped[str] = mapped_column(String(1024), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class GeneratedPost(Base):
    __tablename__ = "generated_posts"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    platform: Mapped[str] = mapped_column(String(32))
    caption: Mapped[str] = mapped_column(Text, default="")
    image_url: Mapped[str] = mapped_column(String(1024), default="")
    image_b64: Mapped[str] = mapped_column(Text, default="")
    canva_edit_url: Mapped[str] = mapped_column(String(1024), default="")
    visual_style: Mapped[str] = mapped_column(String(64), default="")
    source_feature: Mapped[str] = mapped_column(String(64), default="")
    prefill_prompt: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Competitor(Base):
    __tablename__ = "competitors"
    # Partial unique index: external_id="" is the "not yet known" sentinel (e.g. FB page ID
    # pending credentials) and multiple competitors may share it; only non-empty ids must be
    # unique per platform.
    __table_args__ = (
        Index("uq_competitors_platform_ext", "platform", "external_id", unique=True,
              postgresql_where=text("external_id <> ''")),
    )
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    platform: Mapped[str] = mapped_column(String(32))            # facebook | instagram
    name: Mapped[str] = mapped_column(String(128))
    external_id: Mapped[str] = mapped_column(String(256), default="")  # FB page ID | IG username
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow,
                                                  onupdate=_utcnow)


class TrackedKeyword(Base):
    __tablename__ = "tracked_keywords"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    keyword: Mapped[str] = mapped_column(String(256), unique=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class AgentDefinition(Base):
    __tablename__ = "agent_definitions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String(64), unique=True)
    name: Mapped[str] = mapped_column(String(128))
    system_prompt: Mapped[str] = mapped_column(Text, default="")
    skill_keys: Mapped[list[str]] = mapped_column(MutableList.as_mutable(JSON), default=list)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow,
                                                  onupdate=_utcnow)


class SkillDefinition(Base):
    __tablename__ = "skills"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String(64), unique=True)
    name: Mapped[str] = mapped_column(String(128))
    content: Mapped[str] = mapped_column(Text, default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow,
                                                  onupdate=_utcnow)


class OAuthToken(Base):
    __tablename__ = "oauth_tokens"
    provider: Mapped[str] = mapped_column(String(32), primary_key=True)
    access_token: Mapped[str] = mapped_column(Text, default="")
    refresh_token: Mapped[str] = mapped_column(Text, default="")
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow,
                                                  onupdate=_utcnow)
