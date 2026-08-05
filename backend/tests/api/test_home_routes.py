from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from athena.api.app import create_app
from athena.api import deps
from athena.db.models import OwnPost


def test_weekly_kpi_endpoint(session):
    now = datetime.now(timezone.utc)
    session.add(OwnPost(source_id="a", platform="facebook", content="", views=100, likes=10,
                        interactions=15, window_date=now - timedelta(days=1)))
    session.commit()
    app = create_app()
    app.dependency_overrides[deps.get_session] = lambda: session
    body = TestClient(app).get("/home/weekly-kpi").json()
    assert body["posts"] == 1 and body["views"] == 100


def test_weekly_engagement_endpoint(session):
    now = datetime.now(timezone.utc)
    session.add(OwnPost(source_id="p1", platform="facebook", content="Promo", views=100, likes=10,
                        interactions=40, window_date=now - timedelta(days=1)))
    session.commit()
    app = create_app()
    app.dependency_overrides[deps.get_session] = lambda: session
    # default get_llm dependency -> fake mode (no key needed); no comments -> placeholder insights
    body = TestClient(app).get("/home/weekly-engagement").json()
    assert body["top_post"]["source_id"] == "p1"
    assert "summary" in body["insights"]


def test_home_endpoints_documented():
    spec = TestClient(create_app()).get("/openapi.json").json()
    assert "/home/weekly-kpi" in spec["paths"]
    assert "/home/weekly-engagement" in spec["paths"]
    assert spec["paths"]["/home/weekly-kpi"]["get"]["summary"]
    assert spec["paths"]["/home/weekly-kpi"]["get"]["tags"] == ["home"]
