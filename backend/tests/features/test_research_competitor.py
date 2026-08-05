from datetime import datetime, timedelta, timezone

from athena.ai.llm import FakeLLM
from athena.ai.schemas import CompetitorInsights, Recommendation, TitleSuggestions
from athena.db.models import CompetitorComment, CompetitorPost, CompetitorReview
from athena.features.research import research_competitor


def _llm():
    comp = CompetitorInsights(activity_summary="Running promos",
                              recommendations=[Recommendation(title="Publish prices",
                                                              detail="They never list prices")])
    ts = TitleSuggestions(titles=["1", "2", "3", "4", "5"], prefill_prompt="p")
    return FakeLLM({CompetitorInsights: comp, TitleSuggestions: ts})


def test_competitor_analysis_returns_recommendations(session):
    ref = datetime(2026, 7, 8, tzinfo=timezone.utc)
    session.add(CompetitorPost(source_id="cp1", competitor="StorHub", text="First month free!",
                               window_date=ref - timedelta(days=1)))
    session.commit()
    out = research_competitor(session, _llm())
    assert out["insights"].recommendations[0].title == "Publish prices"
    assert out["titles"] == ["1", "2", "3", "4", "5"]


class _UserCapturingLLM:
    def __init__(self, inner):
        self._inner = inner
        self.users: dict[type, str] = {}

    def structured(self, system, user, schema):
        self.users[schema] = user
        return self._inner.structured(system, user, schema)


def test_scoped_to_one_competitor_including_aliases_and_reviews(session):
    ref = datetime(2026, 7, 8, tzinfo=timezone.utc)
    # IG posts are attributed by username; the seeded Competitor config row (platform=instagram,
    # name=StorHub, external_id=storhub_sg -- see seed_data.COMPETITORS) is the alias the
    # research feature must fold into the display name.
    session.add(CompetitorPost(source_id="fb1", competitor="StorHub", platform="facebook",
                               text="storhub-fb-post", like_count=42, comment_count=7,
                               window_date=ref - timedelta(days=1)))
    session.add(CompetitorPost(source_id="ig1", competitor="storhub_sg", platform="instagram",
                               text="storhub-ig-post", window_date=ref - timedelta(days=1)))
    session.add(CompetitorPost(source_id="other1", competitor="Extra Space Asia", platform="facebook",
                               text="rival-post", window_date=ref - timedelta(days=1)))
    session.add(CompetitorReview(source_id="rv1", competitor="StorHub", star_rating=3,
                                 comment="storhub-review-text", reviewer="Ong K.",
                                 place_rating=4.4, place_review_count=210,
                                 window_date=ref - timedelta(days=2)))
    session.commit()
    llm = _UserCapturingLLM(_llm())
    research_competitor(session, llm, competitor="StorHub")
    ctx = llm.users[CompetitorInsights]
    assert "storhub-fb-post" in ctx and "storhub-ig-post" in ctx   # alias folded in
    assert "storhub-review-text" in ctx                            # reviews feed the analysis
    assert "rival-post" not in ctx                                 # other competitor excluded
    assert "(42 likes, 7 comments)" in ctx                         # engagement counts surfaced


def test_competitor_context_bounded_to_recent_posts(session):
    ref = datetime(2026, 7, 8, tzinfo=timezone.utc)
    # 60 posts, ascending dates: post-00 oldest, post-59 newest.
    for i in range(60):
        session.add(CompetitorPost(source_id=f"cp{i:02d}", competitor="StorHub",
                                   text=f"unique-post-{i:02d}",
                                   window_date=ref - timedelta(days=60 - i)))
    session.add(CompetitorComment(source_id="c_old", post_source_id="cp00",
                                  text="comment-on-oldest", window_date=ref - timedelta(days=60)))
    session.add(CompetitorComment(source_id="c_new", post_source_id="cp59",
                                  text="comment-on-newest", window_date=ref - timedelta(days=1)))
    session.commit()
    llm = _UserCapturingLLM(_llm())
    research_competitor(session, llm)   # global (no competitor) -> 50 most recent posts
    ctx = llm.users[CompetitorInsights]
    assert "unique-post-59" in ctx and "unique-post-10" in ctx    # newest 50 reach the prompt
    assert "unique-post-09" not in ctx and "unique-post-00" not in ctx   # oldest 10 do not
    assert "comment-on-newest" in ctx and "comment-on-oldest" not in ctx  # comments scoped to sampled posts
