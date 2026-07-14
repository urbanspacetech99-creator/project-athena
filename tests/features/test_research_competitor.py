from datetime import datetime, timedelta, timezone

from athena.ai.llm import FakeLLM
from athena.ai.schemas import CompetitorInsights, TitleSuggestions
from athena.db.models import CompetitorComment, CompetitorPost
from athena.features.research import research_competitor


def test_competitor_analysis(session):
    ref = datetime(2026, 7, 8, tzinfo=timezone.utc)
    session.add(CompetitorPost(source_id="cp1", competitor="StorHub", text="First month free!",
                               window_date=ref - timedelta(days=1)))
    session.add(CompetitorComment(source_id="cp1_c1", post_source_id="cp1", text="Too expensive",
                                  window_date=ref - timedelta(days=1)))
    session.commit()
    comp = CompetitorInsights(activity_summary="Running promos", weaknesses=["pricing complaints"],
                              gaps=["no climate control mention"])
    ts = TitleSuggestions(titles=["1", "2", "3", "4", "5"], prefill_prompt="p")
    out = research_competitor(session, FakeLLM({CompetitorInsights: comp, TitleSuggestions: ts}))
    assert out["insights"].weaknesses == ["pricing complaints"]
    assert out["titles"] == ["1", "2", "3", "4", "5"]


class _UserCapturingLLM:
    """Wraps FakeLLM, recording the `user` text per schema so tests can inspect context."""

    def __init__(self, inner):
        self._inner = inner
        self.users: dict[type, str] = {}

    def structured(self, system, user, schema):
        self.users[schema] = user
        return self._inner.structured(system, user, schema)


def test_competitor_context_bounded_to_recent_posts(session):
    ref = datetime(2026, 7, 8, tzinfo=timezone.utc)
    # 60 posts with ascending dates: post-00 is the oldest, post-59 the newest.
    for i in range(60):
        session.add(CompetitorPost(source_id=f"cp{i:02d}", competitor="StorHub",
                                   text=f"unique-post-{i:02d}",
                                   window_date=ref - timedelta(days=60 - i)))
    # A comment each on the oldest and the newest post: only the one attached to a
    # sampled (recent) post may reach the prompt.
    session.add(CompetitorComment(source_id="c_old", post_source_id="cp00",
                                  text="comment-on-oldest", window_date=ref - timedelta(days=60)))
    session.add(CompetitorComment(source_id="c_new", post_source_id="cp59",
                                  text="comment-on-newest", window_date=ref - timedelta(days=1)))
    session.commit()

    comp = CompetitorInsights(activity_summary="s", weaknesses=[], gaps=[])
    ts = TitleSuggestions(titles=["1", "2", "3", "4", "5"], prefill_prompt="p")
    llm = _UserCapturingLLM(FakeLLM({CompetitorInsights: comp, TitleSuggestions: ts}))
    research_competitor(session, llm)

    context = llm.users[CompetitorInsights]
    # only the 50 most recent posts (10..59) reach the prompt; the oldest 10 do not
    assert "unique-post-59" in context
    assert "unique-post-10" in context
    assert "unique-post-09" not in context
    assert "unique-post-00" not in context
    # comments are scoped to the sampled posts
    assert "comment-on-newest" in context
    assert "comment-on-oldest" not in context
