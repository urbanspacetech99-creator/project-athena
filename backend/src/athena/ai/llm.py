from typing import Protocol, TypeVar

from pydantic import BaseModel

from athena.ai.schemas import (AggregatedRecommendations, CommentInsights, CompetitorInsights,
                                CustomerInsights, ImagePromptSpec, PostCaption, Recommendation,
                                SocialReviewInsights, TitleSuggestion, TitleSuggestions)
from athena.config import Settings
from athena.logging_setup import get_logger

log = get_logger("athena.ai")
M = TypeVar("M", bound=BaseModel)


class LLMClient(Protocol):
    def structured(self, system: str, user: str, schema: type[M]) -> M: ...


class AnthropicLLM:
    """Live client: Claude Sonnet via langchain-anthropic + structured output."""

    def __init__(self, settings: Settings):
        from langchain_anthropic import ChatAnthropic
        # No temperature: Sonnet 5 rejects non-default sampling params (400).
        # thinking disabled: constrained structured extraction; keeps latency/cost down
        # (Sonnet 5 runs adaptive thinking if `thinking` is omitted).
        self._model = ChatAnthropic(model=settings.claude_model,
                                    api_key=settings.claude_api_key,
                                    thinking={"type": "disabled"},
                                    max_tokens=4096)

    def structured(self, system: str, user: str, schema: type[M]) -> M:
        from langchain_core.messages import HumanMessage, SystemMessage
        log.info("llm call", extra={"schema": schema.__name__, "mode": "live"})
        return self._model.with_structured_output(schema).invoke(
            [SystemMessage(content=system), HumanMessage(content=user)])


class FakeLLM:
    """Deterministic client for tests / no-key dev. Returns registered instances by schema."""

    def __init__(self, responses: dict[type, BaseModel] | None = None):
        self._responses = responses or {}

    def structured(self, system: str, user: str, schema: type[M]) -> M:
        log.info("llm call", extra={"schema": schema.__name__, "mode": "fake"})
        return self._responses[schema]


def default_fake_llm() -> FakeLLM:
    """App-level fake with UrbanSpace-plausible outputs so keyless demos read coherently."""
    titles = [
        TitleSuggestion(title="Storage from S$60/mo at Bukit Merah", confidence=5,
            confidence_reason="Directly matches current promo pricing and location data."),
        TitleSuggestion(title="Hot desks from S$28/day — skip the lease", confidence=4,
            confidence_reason="Grounded in Workspace pricing, though demand signal is thinner."),
        TitleSuggestion(title="Valet Storage: we pack, we move, you don't lift", confidence=4,
            confidence_reason="Reflects a real differentiator, but limited engagement data to confirm appeal."),
        TitleSuggestion(title="Same-day fulfilment for your online store", confidence=3,
            confidence_reason="Plausible angle, but little direct customer signal behind it yet."),
        TitleSuggestion(title="Month-to-month units, 24/7 access", confidence=5,
            confidence_reason="Core value prop repeated consistently across reviews and chats."),
    ]
    prefill = ("Instagram post about UrbanSpace self storage at Bukit Merah: from S$60/mo, "
               "month-to-month, 24/7 access, book online in three minutes.")
    return FakeLLM({
        CommentInsights: CommentInsights(
            summary="Commenters ask about unit sizes, pricing, and 24/7 access.",
            themes=["pricing", "unit sizes", "access hours"], sentiment="positive",
            recurring_feedback=["publish more real prices", "show unit interiors"]),
        TitleSuggestions: TitleSuggestions(titles=titles, prefill_prompt=prefill),
        CustomerInsights: CustomerInsights(
            top_services=["Self Storage", "Valet Storage"],
            top_features=["24/7 access", "climate control"],
            top_promotions=["first-month discount"],
            summary="Most enquiries are about storage unit pricing and Valet Storage pickup."),
        SocialReviewInsights: SocialReviewInsights(
            comment_topics=["pricing", "location", "valet pickup"],
            review_summary="Reviews praise the clean Bukit Merah facility and easy booking."),
        CompetitorInsights: CompetitorInsights(
            activity_summary="Competitors post promo-led storage content with vague pricing.",
            recommendations=[
                Recommendation(title="Publish transparent pricing",
                               detail="Their posts and reviews show customers frustrated by hidden prices.",
                               confidence=5,
                               confidence_reason="Directly backed by multiple competitor reviews naming this complaint."),
                Recommendation(title="Lead with all-four-services convenience",
                               detail="No competitor offers storage, workspace, fulfilment and valet under one roof.",
                               confidence=4,
                               confidence_reason="True from tracked data, though customer demand for the combo isn't directly measured.")]),
        PostCaption: PostCaption(
            caption=("From S$60/month at Bukit Merah. Month-to-month, 24/7 access. "
                     "Book online in three minutes."),
            hashtags=["urbanspacesg", "selfstorage"]),
        ImagePromptSpec: ImagePromptSpec(
            prompt=("Documentary photo, 35mm look: a customer shelving a labelled box in a "
                    "clean self storage unit, door ajar, available light, Urban Orange door "
                    "trim visible."),
            visual_style="clean_product"),
        AggregatedRecommendations: AggregatedRecommendations(
            titles=titles, prefill_prompt=prefill,
            rationale="Search trends, chats, and reviews all point at price-led storage content."),
    })


def get_llm(settings: Settings) -> LLMClient:
    if settings.llm_mode == "live":
        return AnthropicLLM(settings)
    return default_fake_llm()
