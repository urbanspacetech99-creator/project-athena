from fastapi.testclient import TestClient
from athena.api.app import create_app


def test_openapi_documents_endpoints():
    spec = TestClient(create_app()).get("/openapi.json").json()
    assert "/data/own-posts" in spec["paths"]
    assert "/ingest/{source}" in spec["paths"]
    op = spec["paths"]["/data/own-posts"]["get"]
    assert op["summary"] and op["tags"]


def test_own_posts_endpoint_returns_rows(client_with_data):
    resp = client_with_data.get("/data/own-posts?limit=10")
    assert resp.status_code == 200
    body = resp.json()
    assert body["count"] >= 1
    assert body["items"][0]["platform"] == "instagram"


def test_competitor_posts_expose_engagement_counts(session):
    from datetime import datetime, timezone
    from athena.api import deps
    from athena.api.app import create_app
    from athena.db.models import CompetitorPost
    from fastapi.testclient import TestClient
    session.add(CompetitorPost(source_id="cp1", competitor="StorHub", platform="facebook",
                               text="promo", like_count=42, comment_count=7,
                               window_date=datetime(2026, 7, 8, tzinfo=timezone.utc)))
    session.commit()
    app = create_app()
    app.dependency_overrides[deps.get_session] = lambda: session
    body = TestClient(app).get("/data/competitor-posts?limit=50").json()
    row = next(r for r in body["items"] if r["source_id"] == "cp1")
    assert row["like_count"] == 42 and row["comment_count"] == 7


def test_competitor_reviews_endpoint_returns_rows(session):
    from datetime import datetime, timezone
    from athena.api import deps
    from athena.api.app import create_app
    from athena.db.models import CompetitorReview
    from fastapi.testclient import TestClient
    session.add(CompetitorReview(source_id="pr1", competitor="StorHub", star_rating=4,
                                 comment="Pricing unclear", reviewer="Nur A.",
                                 place_rating=4.4, place_review_count=210,
                                 window_date=datetime(2026, 7, 8, tzinfo=timezone.utc)))
    session.commit()
    app = create_app()
    app.dependency_overrides[deps.get_session] = lambda: session
    body = TestClient(app).get("/data/competitor-reviews?limit=50").json()
    row = next(r for r in body["items"] if r["source_id"] == "pr1")
    assert row["competitor"] == "StorHub" and row["place_review_count"] == 210
    assert row["reviewer"] == "Nur A." and row["star_rating"] == 4
