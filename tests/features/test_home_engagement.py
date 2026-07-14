from datetime import datetime, timedelta, timezone
from athena.db.models import OwnPost, PostComment
from athena.ai.schemas import CommentInsights
from athena.ai.llm import FakeLLM
from athena.features.home import build_engagement_graph


def test_engagement_graph_top_post_and_insights(session):
    ref = datetime(2026, 7, 8, tzinfo=timezone.utc)
    session.add(OwnPost(source_id="p1", platform="facebook", content="Promo", views=100,
                        likes=10, interactions=40, window_date=ref - timedelta(days=1)))
    session.add(OwnPost(source_id="p2", platform="instagram", content="Tips", views=50,
                        likes=5, interactions=8, window_date=ref - timedelta(days=2)))
    session.add(PostComment(source_id="p1_c1", post_source_id="p1", text="Do you have drive-up access?",
                            window_date=ref - timedelta(days=1)))
    session.commit()

    canned = CommentInsights(summary="Customers ask about access", themes=["access"],
                             sentiment="positive", recurring_feedback=["drive-up access"])
    graph = build_engagement_graph(session, FakeLLM({CommentInsights: canned}))
    out = graph.invoke({"reference": ref, "top_post": None, "insights": None})
    assert out["top_post"]["source_id"] == "p1"
    assert out["insights"].themes == ["access"]


def test_engagement_no_comments_returns_placeholder(session):
    ref = datetime(2026, 7, 8, tzinfo=timezone.utc)
    session.add(OwnPost(source_id="p9", platform="facebook", content="x", views=1, likes=1,
                        interactions=1, window_date=ref - timedelta(days=1)))
    session.commit()
    # No comments -> node returns a placeholder CommentInsights WITHOUT calling the LLM
    graph = build_engagement_graph(session, FakeLLM({}))  # empty registry: LLM must NOT be called
    out = graph.invoke({"reference": ref, "top_post": None, "insights": None})
    assert out["insights"].summary  # some placeholder text
    assert out["top_post"]["source_id"] == "p9"
