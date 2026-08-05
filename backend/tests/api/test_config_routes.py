from fastapi.testclient import TestClient

from athena.api import deps
from athena.api.app import create_app
from athena.config import Settings


def _client(session):
    app = create_app()
    app.dependency_overrides[deps.get_session] = lambda: session
    return TestClient(app)


def test_competitors_crud(session):
    client = _client(session)
    seeded = client.get("/config/competitors").json()
    assert seeded["count"] >= 2
    ig_only = client.get("/config/competitors?platform=instagram").json()
    assert all(c["platform"] == "instagram" for c in ig_only["items"])

    created = client.post("/config/competitors", json={
        "platform": "instagram", "name": "Lock+Store", "external_id": "lockandstore"}).json()
    cid = created["id"]
    assert created["enabled"] is True

    patched = client.patch(f"/config/competitors/{cid}", json={"enabled": False}).json()
    assert patched["enabled"] is False
    assert client.delete(f"/config/competitors/{cid}").status_code == 204
    assert client.patch(f"/config/competitors/{cid}", json={"enabled": True}).status_code == 404


def test_competitor_platform_validated(session):
    assert _client(session).post("/config/competitors", json={
        "platform": "tiktok", "name": "X", "external_id": "x"}).status_code == 422


def test_google_competitor_accepted(session):
    created = _client(session).post("/config/competitors", json={
        "platform": "google", "name": "StorHub", "external_id": "places/ChIJstorhub0002"})
    assert created.status_code == 201
    assert created.json()["platform"] == "google"


def test_keywords_crud(session):
    client = _client(session)
    assert client.get("/config/keywords").json()["count"] >= 5
    created = client.post("/config/keywords", json={"keyword": "wine storage singapore"}).json()
    kid = created["id"]
    assert client.patch(f"/config/keywords/{kid}", json={"enabled": False}).json()["enabled"] is False
    assert client.delete(f"/config/keywords/{kid}").status_code == 204


def test_duplicate_conflicts_return_409(session):
    client = _client(session)
    # seeded keyword -> unique constraint on TrackedKeyword.keyword
    assert client.post("/config/keywords",
                       json={"keyword": "self storage singapore"}).status_code == 409
    # seeded competitor -> partial unique index on (platform, external_id)
    assert client.post("/config/competitors", json={
        "platform": "instagram", "name": "Dup", "external_id": "extraspaceasia"}).status_code == 409
    # renaming a keyword onto an existing one also conflicts
    created = client.post("/config/keywords", json={"keyword": "temp keyword"}).json()
    assert client.patch(f"/config/keywords/{created['id']}",
                        json={"keyword": "self storage singapore"}).status_code == 409


def test_agents_read_patch_and_effective_prompt(session):
    client = _client(session)
    agents = client.get("/config/agents").json()
    assert agents["count"] == 8
    one = client.get("/config/agents/caption_writer").json()
    assert one["skill_keys"] == ["brand-identity", "tone-of-voice", "content-rules"]

    patched = client.patch("/config/agents/caption_writer", json={
        "system_prompt": "New prompt.", "skill_keys": ["tone-of-voice"]}).json()
    assert patched["system_prompt"] == "New prompt."

    effective = client.get("/config/agents/caption_writer/effective-prompt").json()
    assert effective["effective_prompt"].startswith("New prompt.")
    assert "Plain-spoken" in effective["effective_prompt"]

    assert client.patch("/config/agents/caption_writer",
                        json={"skill_keys": ["nope"]}).status_code == 422
    assert client.get("/config/agents/nope").status_code == 404


def test_skills_crud_and_detach(session):
    client = _client(session)
    assert client.get("/config/skills").json()["count"] == 4
    client.post("/config/skills", json={"key": "cny-campaign", "name": "CNY campaign",
                                        "content": "Mention the CNY decluttering angle."})
    assert client.post("/config/skills", json={"key": "cny-campaign", "name": "Duplicate",
                                               "content": "Should conflict."}).status_code == 409

    patched = client.patch("/config/skills/cny-campaign", json={"content": "Updated angle."}).json()
    assert patched["content"] == "Updated angle."
    fetched = client.get("/config/skills").json()
    assert next(s for s in fetched["items"]
                if s["key"] == "cny-campaign")["content"] == "Updated angle."

    client.patch("/config/agents/caption_writer", json={"skill_keys": ["cny-campaign"]})
    deleted = client.delete("/config/skills/cny-campaign")
    assert deleted.status_code == 200
    assert deleted.json()["detached_from"] == ["caption_writer"]
    assert client.get("/config/agents/caption_writer").json()["skill_keys"] == []


def test_config_endpoints_documented():
    spec = TestClient(create_app()).get("/openapi.json").json()
    for p in ["/config/competitors", "/config/keywords", "/config/agents/{key}",
              "/config/skills", "/config/agents/{key}/effective-prompt"]:
        assert p in spec["paths"]


def test_modes_endpoint_reflects_settings():
    app = create_app()
    # Live global: per-source overrides are reflected (meta downgraded to a fixture
    # fallback). _env_file=None so the developer's .env can't leak into the assertion.
    # All per-source overrides passed explicitly (init wins over the hermetic-fixture env
    # vars): meta stays a fixture fallback, the rest inherit the live global.
    app.dependency_overrides[deps.get_settings] = lambda: Settings(
        _env_file=None, db_auto_create=False, source_mode="live", meta_source_mode="fixture",
        google_reviews_source_mode="", google_ads_source_mode="", zoho_source_mode="",
        google_places_source_mode="", llm_mode="live", image_mode="fake", canva_mode="live")
    body = TestClient(app).get("/config/modes").json()
    # Exact equality also proves no extra (secret-bearing) fields leak into the payload.
    assert body == {
        "sources": {"meta": "fixture", "google_reviews": "live",
                    "google_ads": "live", "zoho": "live", "google_places": "live"},
        "ai": {"llm": "live", "image": "fake", "canva": "live"},
    }


def test_modes_endpoint_fixture_mode_reports_all_fixture():
    app = create_app()
    # Fixture global serves the fixture DB, which holds only fixture data — so every source
    # reports fixture even when an override is pinned live (the override applies only in
    # live mode). This keeps the StatusBadge honest about what is actually being served.
    app.dependency_overrides[deps.get_settings] = lambda: Settings(
        _env_file=None, db_auto_create=False, source_mode="fixture", zoho_source_mode="live",
        llm_mode="fake", image_mode="fake", canva_mode="fake")
    body = TestClient(app).get("/config/modes").json()
    assert body == {
        "sources": {"meta": "fixture", "google_reviews": "fixture",
                    "google_ads": "fixture", "zoho": "fixture", "google_places": "fixture"},
        "ai": {"llm": "fake", "image": "fake", "canva": "fake"},
    }


def test_modes_endpoint_documented():
    spec = TestClient(create_app()).get("/openapi.json").json()
    assert "/config/modes" in spec["paths"]
