from datetime import datetime, timedelta, timezone
from athena.db.models import OwnPost, PostComment, GoogleReview
from athena.ai.llm import FakeLLM
from athena.ai.schemas import SocialReviewInsights, TitleSuggestions
from athena.features.research import research_social_reviews


def test_social_reviews(session):
    ref = datetime(2026, 7, 8, tzinfo=timezone.utc)
    session.add(OwnPost(source_id="p1", platform="instagram", content="", views=200, likes=1,
                        interactions=1, window_date=ref - timedelta(days=1)))
    session.add(PostComment(source_id="p1_c1", post_source_id="p1", text="Do you offer lockers?",
                            window_date=ref - timedelta(days=1)))
    session.add(GoogleReview(source_id="r1", star_rating=5, comment="Great and clean",
                             reviewer="A", window_date=ref - timedelta(days=2)))
    session.commit()
    sri = SocialReviewInsights(comment_topics=["lockers"], review_summary="Positive, clean facility")
    ts = TitleSuggestions(titles=["1", "2", "3", "4", "5"], prefill_prompt="p")
    out = research_social_reviews(session, FakeLLM({SocialReviewInsights: sri, TitleSuggestions: ts}), reference=ref)
    assert out["views"] == 200
    assert out["insights"].comment_topics == ["lockers"]
    assert out["titles"] == ["1", "2", "3", "4", "5"]


def test_social_reviews_empty_data_skips_insights_llm(session):
    """Live mode with fixture-pinned comments/reviews skipped leaves both sections empty.
    The insights LLM must NOT be consulted then — an ungrounded call makes the model emit
    a literal `<UNKNOWN>` placeholder for review_summary. FakeLLM here only knows
    TitleSuggestions, so any SocialReviewInsights call raises KeyError."""
    ref = datetime(2026, 7, 8, tzinfo=timezone.utc)
    session.add(OwnPost(source_id="p1", platform="instagram", content="", views=200, likes=1,
                        interactions=1, window_date=ref - timedelta(days=1)))
    session.commit()
    ts = TitleSuggestions(titles=["1", "2", "3", "4", "5"], prefill_prompt="p")
    out = research_social_reviews(session, FakeLLM({TitleSuggestions: ts}), reference=ref)
    assert out["insights"].comment_topics == []
    assert out["insights"].review_summary == "No comments or reviews ingested yet."


def test_social_reviews_no_reviews_gets_deterministic_summary(session):
    """Comments exist but reviews don't: the LLM is asked about comments, but its
    review_summary (ungrounded — simulate the live placeholder) must be replaced with a
    deterministic message."""
    ref = datetime(2026, 7, 8, tzinfo=timezone.utc)
    session.add(OwnPost(source_id="p1", platform="instagram", content="", views=200, likes=1,
                        interactions=1, window_date=ref - timedelta(days=1)))
    session.add(PostComment(source_id="p1_c1", post_source_id="p1", text="Do you offer lockers?",
                            window_date=ref - timedelta(days=1)))
    session.commit()
    sri = SocialReviewInsights(comment_topics=["lockers"], review_summary="<UNKNOWN>")
    ts = TitleSuggestions(titles=["1", "2", "3", "4", "5"], prefill_prompt="p")
    out = research_social_reviews(session, FakeLLM({SocialReviewInsights: sri, TitleSuggestions: ts}), reference=ref)
    assert out["insights"].comment_topics == ["lockers"]
    assert out["insights"].review_summary == "No Google reviews ingested yet."
