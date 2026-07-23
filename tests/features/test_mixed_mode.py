"""Mixed mode end to end: global live serving live sources from the live DB and
fixture-pinned sources from the fixture DB, side by side (source-routing design)."""
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from athena.ai.llm import FakeLLM
from athena.ai.schemas import SocialReviewInsights, TitleSuggestions
from athena.db.base import make_session_factory
from athena.db.models import GoogleReview, OwnPost
from athena.db.seed import seed_defaults
from athena.features.research import research_social_reviews
from athena.ingestion.runner import IngestResult
from athena.jobs.ingestion_jobs import ingest_google_reviews

REF = datetime(2026, 7, 8, tzinfo=timezone.utc)


class RecordingLLM(FakeLLM):
    """FakeLLM that records every (system, user, schema) call for grounding asserts."""

    def __init__(self, responses):
        super().__init__(responses)
        self.calls = []

    def structured(self, system, user, schema):
        self.calls.append((system, user, schema))
        return super().structured(system, user, schema)


def test_live_mode_ingests_pinned_source_into_fixture_db(two_dbs, routed_settings):
    # google_reviews is fixture-pinned while the global mode is live: the job must RUN
    # (not skip) and its fixture rows must land only in the fixture DB.
    settings = routed_settings()
    factory = make_session_factory(settings=settings)
    result = ingest_google_reviews(factory, settings)
    assert isinstance(result, IngestResult)
    assert result.inserted > 0
    with Session(two_dbs["fx"]) as raw:
        assert raw.query(GoogleReview).count() == result.inserted
    with Session(two_dbs["live"]) as raw:
        assert raw.query(GoogleReview).count() == 0       # live DB purity


def test_research_social_reviews_composes_live_posts_and_fixture_reviews(
        two_dbs, routed_settings):
    with Session(two_dbs["live"]) as raw:                 # live side: own posts + config
        seed_defaults(raw)                                # agent prompts (default bind)
        raw.add(OwnPost(source_id="p1", platform="instagram", content="", views=321,
                        likes=1, interactions=1, window_date=REF - timedelta(days=1)))
        raw.commit()
    with Session(two_dbs["fx"]) as raw:                   # fixture side: google reviews
        raw.add(GoogleReview(source_id="r1", star_rating=5,
                             comment="Great and clean facility", reviewer="A",
                             window_date=REF - timedelta(days=2)))
        raw.commit()
    sri = SocialReviewInsights(comment_topics=["cleanliness"],
                               review_summary="Reviews praise cleanliness")
    ts = TitleSuggestions(titles=["1", "2", "3", "4", "5"], prefill_prompt="p")
    llm = RecordingLLM({SocialReviewInsights: sri, TitleSuggestions: ts})
    factory = make_session_factory(settings=routed_settings())
    with factory() as s:
        out = research_social_reviews(s, llm, reference=REF)
    assert out["views"] == 321                            # grounded in the live DB post
    # The insights LLM ran (reviews were found — no empty-state shortcut) and its
    # context carried the fixture-DB review text.
    assert out["insights"].review_summary == "Reviews praise cleanliness"
    insight_calls = [u for _, u, sch in llm.calls if sch is SocialReviewInsights]
    assert len(insight_calls) == 1
    assert "Great and clean facility" in insight_calls[0]
