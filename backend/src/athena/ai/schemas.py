from pydantic import BaseModel, Field


class CommentInsights(BaseModel):
    summary: str = Field(description="Short overall reading of the comments")
    themes: list[str] = Field(default_factory=list, description="Recurring themes")
    sentiment: str = Field(default="neutral", description="positive|neutral|negative|mixed")
    recurring_feedback: list[str] = Field(default_factory=list, description="Specific recurring feedback points")


class TitleSuggestion(BaseModel):
    title: str = Field(description="A single suggested post title")
    confidence: int = Field(ge=1, le=5,
        description="1-5 confidence that this idea is well-grounded and will perform")
    confidence_reason: str = Field(description="One-sentence reason for this specific confidence score")


class TitleSuggestions(BaseModel):
    titles: list[TitleSuggestion] = Field(default_factory=list,
        description="Exactly 5 suggested post titles, each with its own confidence score")
    prefill_prompt: str = Field(default="", description="A prompt to pre-fill the Generate tab")


class CustomerInsights(BaseModel):
    top_services: list[str] = Field(default_factory=list)
    top_features: list[str] = Field(default_factory=list)
    top_promotions: list[str] = Field(default_factory=list)
    summary: str = ""


class Recommendation(BaseModel):
    title: str = Field(description="Short, specific recommendation headline")
    detail: str = Field(description="One-sentence explanation grounded in the competitor's data")
    confidence: int = Field(ge=1, le=5,
        description="1-5 confidence that this recommendation is well-grounded and effective")
    confidence_reason: str = Field(description="One-sentence reason for this specific confidence score")


class CompetitorInsights(BaseModel):
    activity_summary: str = ""
    recommendations: list[Recommendation] = Field(default_factory=list)


class SocialReviewInsights(BaseModel):
    comment_topics: list[str] = Field(default_factory=list)
    review_summary: str = ""


class PostCaption(BaseModel):
    caption: str = Field(default="", description="The post caption text")
    hashtags: list[str] = Field(default_factory=list, description="Relevant hashtags without '#'")


class ImagePromptSpec(BaseModel):
    prompt: str = Field(default="", description="Text-to-image prompt for the visual")
    visual_style: str = Field(default="", description="before_after|clean_product|lifestyle|text_forward")


class AggregatedRecommendations(BaseModel):
    titles: list[TitleSuggestion] = Field(default_factory=list,
        description="Exactly 5 cross-source post titles, each with its own confidence score")
    prefill_prompt: str = Field(default="", description="A prompt to pre-fill the Generate tab")
    rationale: str = Field(default="", description="Why these recommendations, across sources")
