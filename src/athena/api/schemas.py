from datetime import datetime
from typing import Generic, Literal, TypeVar

from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")


class _ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class OwnPostOut(_ORM):
    id: int
    source_id: str
    platform: str
    title: str
    content: str
    views: int
    likes: int
    interactions: int
    window_date: datetime


class PostCommentOut(_ORM):
    id: int
    source_id: str
    post_source_id: str
    text: str
    window_date: datetime


class CompetitorPostOut(_ORM):
    id: int
    source_id: str
    competitor: str
    platform: str
    text: str
    window_date: datetime


class GoogleReviewOut(_ORM):
    id: int
    source_id: str
    star_rating: int
    comment: str
    reviewer: str
    window_date: datetime


class KeywordVolumeOut(_ORM):
    id: int
    source_id: str
    keyword: str
    weekly_search_volume: int
    window_date: datetime


class ZohoChatOut(_ORM):
    id: int
    source_id: str
    transcript: str
    window_date: datetime


class ListResponse(BaseModel, Generic[T]):
    items: list[T]
    count: int


class IngestResponse(BaseModel):
    source: str
    inserted: int
    updated: int
    total: int
    failed: list[str] = []


class KpiSnapshotOut(BaseModel):
    posts: int
    views: int
    likes: int
    interactions: int


class TopPostOut(BaseModel):
    source_id: str
    platform: str
    content: str
    views: int
    likes: int
    interactions: int


class CommentInsightsOut(BaseModel):
    summary: str
    themes: list[str]
    sentiment: str
    recurring_feedback: list[str]


class EngagementSummaryOut(BaseModel):
    top_post: TopPostOut | None
    insights: CommentInsightsOut


class KeywordOut(BaseModel):
    keyword: str
    weekly_search_volume: int


class TrendsOut(BaseModel):
    keywords: list[KeywordOut]
    titles: list[str]
    prefill_prompt: str


class QuestionsOut(BaseModel):
    questions: list[str]


class CustomerInsightsOut(BaseModel):
    top_services: list[str]
    top_features: list[str]
    top_promotions: list[str]
    summary: str


class CustomerInsightsResponse(BaseModel):
    insights: CustomerInsightsOut
    titles: list[str]
    prefill_prompt: str


class SocialReviewOut(BaseModel):
    comment_topics: list[str]
    review_summary: str


class SocialResponse(BaseModel):
    views: int
    insights: SocialReviewOut
    titles: list[str]
    prefill_prompt: str


class CompetitorOut(BaseModel):
    activity_summary: str
    weaknesses: list[str]
    gaps: list[str]


class CompetitorResponse(BaseModel):
    insights: CompetitorOut
    titles: list[str]
    prefill_prompt: str


class GeneratePostIn(BaseModel):
    platform: str = "instagram"
    tone: str = "friendly"
    length: str = "short"
    prefill_prompt: str = ""
    visual_style: str = "clean_product"
    include_hashtags: bool = True
    include_cta: bool = True
    include_emoji: bool = False
    include_pricing: bool = False
    options: int = Field(default=3, ge=1)


class PostOptionOut(BaseModel):
    caption: str
    hashtags: list[str]
    image_b64: str
    mime_type: str
    canva_edit_url: str
    visual_style: str


class GeneratePostOut(BaseModel):
    options: list[PostOptionOut]


class DraftIn(BaseModel):
    platform: str
    caption: str
    image_b64: str = ""
    canva_edit_url: str = ""


class DraftUpdateIn(BaseModel):
    caption: str | None = None
    platform: str | None = None


class DraftOut(_ORM):
    id: int
    platform: str
    caption: str
    image_b64: str
    canva_edit_url: str
    created_at: datetime


class RecommendationsOut(BaseModel):
    titles: list[str]
    prefill_prompt: str
    rationale: str


class CompetitorIn(BaseModel):
    platform: Literal["facebook", "instagram"]
    name: str = Field(min_length=1)
    external_id: str = ""


class CompetitorUpdateIn(BaseModel):
    name: str | None = Field(default=None, min_length=1)
    external_id: str | None = None
    enabled: bool | None = None


class CompetitorOutRow(_ORM):
    id: int
    platform: str
    name: str
    external_id: str
    enabled: bool
    created_at: datetime
    updated_at: datetime


class KeywordIn(BaseModel):
    keyword: str = Field(min_length=1)


class KeywordUpdateIn(BaseModel):
    keyword: str | None = Field(default=None, min_length=1)
    enabled: bool | None = None


class TrackedKeywordOut(_ORM):
    id: int
    keyword: str
    enabled: bool
    created_at: datetime


class AgentOut(_ORM):
    id: int
    key: str
    name: str
    system_prompt: str
    skill_keys: list[str]
    updated_at: datetime


class AgentUpdateIn(BaseModel):
    system_prompt: str | None = None
    skill_keys: list[str] | None = None


class EffectivePromptOut(BaseModel):
    key: str
    effective_prompt: str


class SkillIn(BaseModel):
    key: str = Field(min_length=1, pattern=r"^[a-z0-9]+(-[a-z0-9]+)*$")
    name: str = Field(min_length=1)
    content: str


class SkillUpdateIn(BaseModel):
    name: str | None = Field(default=None, min_length=1)
    content: str | None = Field(default=None, min_length=1)


class SkillOut(_ORM):
    id: int
    key: str
    name: str
    content: str
    updated_at: datetime


class SkillDeleteOut(BaseModel):
    deleted: str
    detached_from: list[str]


class SourceModesOut(BaseModel):
    meta: str
    google_reviews: str
    google_ads: str
    zoho: str


class AiModesOut(BaseModel):
    llm: str
    image: str
    canva: str


class ModesOut(BaseModel):
    sources: SourceModesOut
    ai: AiModesOut
