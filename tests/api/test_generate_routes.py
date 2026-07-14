from datetime import datetime, timezone

from fastapi.testclient import TestClient

from athena.api import deps
from athena.api.app import create_app
from athena.db.models import KeywordVolume, OwnPost, GoogleReview, CompetitorPost, ZohoChat

NOW = datetime.now(timezone.utc)


def _client(session):
    app = create_app()
    app.dependency_overrides[deps.get_session] = lambda: session
    return TestClient(app)


def test_generate_post_endpoint(session):
    client = _client(session)
    body = client.post("/generate/post", json={"platform": "instagram",
                                                "prefill_prompt": "climate units"}).json()
    assert len(body["options"]) == 3
    assert body["options"][0]["image_b64"]
    assert body["options"][0]["canva_edit_url"].startswith("https://www.canva.com/design/")


def test_drafts_crud_endpoints(session):
    client = _client(session)
    created = client.post("/generate/drafts", json={"platform": "instagram",
                                                     "caption": "hi"}).json()
    did = created["id"]
    assert client.get("/generate/drafts").json()["count"] == 1
    assert client.get(f"/generate/drafts/{did}").json()["caption"] == "hi"
    patched = client.patch(f"/generate/drafts/{did}", json={"caption": "bye"}).json()
    assert patched["caption"] == "bye"
    assert client.delete(f"/generate/drafts/{did}").status_code == 204
    assert client.get(f"/generate/drafts/{did}").status_code == 404


def test_recommendations_endpoint(session):
    session.add(KeywordVolume(source_id="k1", window_date=NOW, keyword="self storage",
                              weekly_search_volume=100))
    session.add(OwnPost(source_id="p1", window_date=NOW, platform="instagram", title="t",
                        content="tour", views=1, likes=1, interactions=1))
    session.add(GoogleReview(source_id="r1", window_date=NOW, star_rating=5, comment="good",
                             reviewer="A"))
    session.add(CompetitorPost(source_id="c1", window_date=NOW, competitor="BoxCo", text="x"))
    session.add(ZohoChat(source_id="z1", window_date=NOW, transcript="Customer: price?"))
    session.commit()
    body = _client(session).get("/generate/recommendations").json()
    assert len(body["titles"]) == 5 and "rationale" in body


def test_generate_endpoints_documented():
    spec = TestClient(create_app()).get("/openapi.json").json()
    for p in ["/generate/post", "/generate/drafts", "/generate/recommendations"]:
        assert p in spec["paths"]
