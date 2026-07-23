def test_trigger_ingestion_fixture_mode(client_with_db):
    resp = client_with_db.post("/ingest/google_ads")
    assert resp.status_code == 200
    body = resp.json()
    assert body["source"] == "google_ads"
    assert body["total"] >= 1
    assert body["total"] == body["inserted"] + body["updated"]


def test_trigger_meta_totals_consistent(client_with_db):
    body = client_with_db.post("/ingest/meta").json()
    assert body["total"] == body["inserted"] + body["updated"]


def test_unknown_source_400(client_with_db):
    assert client_with_db.post("/ingest/nope").status_code == 400


def test_trigger_competitor_reviews_fixture_mode(client_with_db):
    resp = client_with_db.post("/ingest/competitor_reviews")
    assert resp.status_code == 200
    body = resp.json()
    assert body["source"] == "competitor_reviews"
    assert body["total"] > 0
    assert body["total"] == body["inserted"] + body["updated"]


def test_trigger_ingestion_skipped_when_fixture_pinned(client_with_db, session):
    """Degenerate single-DB config (live global + fixture-pinned source, no fixture DB):
    the response reports skipped with zero counts and nothing is written (the session
    targets the live DB here). fixture_database_url pinned empty — a developer's
    exported FIXTURE_DATABASE_URL would otherwise flip this into the routed config."""
    from athena.api import deps
    from athena.config import Settings
    from athena.db.models import GoogleReview

    client_with_db.app.dependency_overrides[deps.get_settings] = lambda: Settings(
        _env_file=None, source_mode="live", fixture_database_url="",
        google_reviews_source_mode="fixture")
    resp = client_with_db.post("/ingest/google_reviews")
    assert resp.status_code == 200
    body = resp.json()
    assert body["skipped"] is True
    assert body["inserted"] == body["updated"] == body["total"] == 0
    assert session.query(GoogleReview).count() == 0


def test_trigger_competitor_surfaces_failed_name(client_with_db, monkeypatch):
    """A competitor whose fetch blows up must be reported by name in `failed`,
    not just swallowed into the totals -- proves the job-dict -> IngestResponse wiring."""
    from athena.adapters.meta import MetaCompetitorAdapter

    def boom(self, **kwargs):
        raise RuntimeError("simulated adapter failure")

    monkeypatch.setattr(MetaCompetitorAdapter, "fetch_fixture", boom)
    resp = client_with_db.post("/ingest/competitor")
    assert resp.status_code == 200
    body = resp.json()
    assert body["failed"] == ["Extra Space Asia"]
