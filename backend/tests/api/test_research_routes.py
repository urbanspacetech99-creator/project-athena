from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from athena.api.app import create_app
from athena.api import deps
from athena.db.models import KeywordVolume


def test_internet_trends_endpoint(session):
    now = datetime.now(timezone.utc)
    session.add(KeywordVolume(source_id="self storage", keyword="self storage",
                              weekly_search_volume=100, window_date=now - timedelta(days=1)))
    session.commit()
    app = create_app()
    app.dependency_overrides[deps.get_session] = lambda: session
    body = TestClient(app).get("/research/internet-trends").json()
    assert body["keywords"][0]["keyword"] == "self storage"
    assert "titles" in body and "prefill_prompt" in body


def test_research_endpoints_documented():
    spec = TestClient(create_app()).get("/openapi.json").json()
    for p in ["/research/internet-trends", "/research/customer-questions",
              "/research/customer-insights", "/research/social-reviews", "/research/competitor"]:
        assert p in spec["paths"]
        assert spec["paths"][p]["get"]["summary"] and spec["paths"][p]["get"]["tags"] == ["research"]


def test_ai_research_endpoints_run_in_fake_mode(session):
    from datetime import datetime, timedelta, timezone
    from athena.db.models import OwnPost, PostComment, GoogleReview, ZohoChat, CompetitorPost, CompetitorComment
    ref = datetime.now(timezone.utc)
    session.add(OwnPost(source_id="p1", platform="instagram", content="", views=5, likes=1,
                        interactions=1, window_date=ref - timedelta(days=1)))
    session.add(PostComment(source_id="p1_c1", post_source_id="p1", text="lockers?",
                            window_date=ref - timedelta(days=1)))
    session.add(GoogleReview(source_id="r1", star_rating=5, comment="clean", reviewer="A",
                             window_date=ref - timedelta(days=1)))
    session.add(ZohoChat(source_id="z1", transcript="Customer: price?\nAgent: $180.",
                         window_date=ref - timedelta(days=1)))
    session.add(CompetitorPost(source_id="cp1", competitor="StorHub", text="promo",
                               window_date=ref - timedelta(days=1)))
    session.add(CompetitorComment(source_id="cp1_c1", post_source_id="cp1", text="pricey",
                                  window_date=ref - timedelta(days=1)))
    session.commit()
    app = create_app()
    app.dependency_overrides[deps.get_session] = lambda: session
    client = TestClient(app)
    for path in ["/research/customer-insights", "/research/social-reviews", "/research/competitor"]:
        r = client.get(path)
        assert r.status_code == 200, (path, r.text)
        body = r.json()
        assert "titles" in body and "prefill_prompt" in body


def test_competitor_endpoint_shape_and_scoping(session):
    from athena.db.models import CompetitorPost
    ref = datetime.now(timezone.utc)
    session.add(CompetitorPost(source_id="cp1", competitor="StorHub", platform="facebook",
                               text="promo", window_date=ref - timedelta(days=1)))
    session.commit()
    app = create_app()
    app.dependency_overrides[deps.get_session] = lambda: session
    client = TestClient(app)
    body = client.get("/research/competitor").json()
    assert "activity_summary" in body["insights"]
    assert isinstance(body["insights"]["recommendations"], list)
    assert set(body["insights"]["recommendations"][0]) == {"title", "detail"}   # fake LLM yields 2
    assert client.get("/research/competitor?competitor=StorHub").status_code == 200  # per-competitor form
