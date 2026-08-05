from datetime import datetime, timezone

from athena.ai.llm import default_fake_llm
from athena.db.models import CompetitorPost, GoogleReview, KeywordVolume, OwnPost, ZohoChat
from athena.features.aggregate import aggregated_recommendations_stream

NOW = datetime.now(timezone.utc)


def _seed(session):
    session.add(KeywordVolume(source_id="k1", window_date=NOW, keyword="self storage",
                              weekly_search_volume=100))
    session.add(OwnPost(source_id="p1", window_date=NOW, platform="instagram", title="t",
                        content="tour", views=1, likes=1, interactions=1))
    session.add(GoogleReview(source_id="r1", window_date=NOW, star_rating=5, comment="good",
                             reviewer="A"))
    session.add(CompetitorPost(source_id="c1", window_date=NOW, competitor="BoxCo", text="x"))
    session.add(ZohoChat(source_id="z1", window_date=NOW, transcript="Customer: price?"))
    session.commit()


def test_aggregator_stream_five_steps_then_result(session):
    _seed(session)
    events = list(aggregated_recommendations_stream(session, default_fake_llm()))
    progress = [e for e in events if e["event"] == "progress"]
    assert [p["step"] for p in progress] == list(range(6))  # 0..5 = start + 4 analysts + synthesis
    assert {p["total"] for p in progress} == {5}
    # Analysts run in parallel threads — order varies; assert the label SET.
    assert {p["label"] for p in progress[1:]} == {
        "Analyzed internet trends", "Analyzed customer chats",
        "Analyzed social & reviews", "Analyzed competitors",
        "Synthesized recommendations"}
    assert events[-1]["event"] == "result"
    assert len(events[-1]["data"]["titles"]) == 5
    assert events[-1]["data"]["rationale"]
