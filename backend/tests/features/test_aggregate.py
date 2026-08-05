from datetime import datetime, timezone

from athena.ai.llm import default_fake_llm
from athena.db.models import (CompetitorPost, GoogleReview, KeywordVolume, OwnPost, ZohoChat)
from athena.features.aggregate import aggregated_recommendations, build_aggregator_graph

NOW = datetime.now(timezone.utc)


def _seed(session):
    session.add(KeywordVolume(source_id="k1", window_date=NOW, keyword="self storage",
                              weekly_search_volume=100))
    session.add(OwnPost(source_id="p1", window_date=NOW, platform="instagram", title="t",
                        content="unit tour", views=50, likes=5, interactions=8))
    session.add(GoogleReview(source_id="r1", window_date=NOW, star_rating=5, comment="great",
                             reviewer="A"))
    session.add(CompetitorPost(source_id="c1", window_date=NOW, competitor="BoxCo", text="promo"))
    session.add(ZohoChat(source_id="z1", window_date=NOW, transcript="Customer: price?"))
    session.commit()


def test_aggregator_graph_fans_out_to_four_sources(session):
    _seed(session)
    graph = build_aggregator_graph(session, default_fake_llm())
    state = graph.invoke({"findings": [], "result": None})
    sources = {f["source"] for f in state["findings"]}
    assert sources == {"internet_trends", "customer_insights", "social_reviews", "competitor"}


def test_aggregated_recommendations_synthesises(session):
    _seed(session)
    from athena.ai.llm import default_fake_llm
    from athena.ai.schemas import AggregatedRecommendations

    base = default_fake_llm()
    seen = {}

    class SpyLLM:
        def structured(self, system, user, schema):
            if schema is AggregatedRecommendations:
                seen["user"] = user
            return base.structured(system, user, schema)

    out = aggregated_recommendations(session, SpyLLM())
    assert len(out["titles"]) == 5
    assert "prefill_prompt" in out and "rationale" in out
    # synthesis must have seen all four sources' findings (fan-in barrier)
    for tag in ("internet_trends", "customer_insights", "social_reviews", "competitor"):
        assert tag in seen["user"]
