"""End-to-end boot smoke test through the real FastAPI lifespan.

Unlike the rest of the suite (which builds its own engine/session via the `session`
fixture), this test drives `create_app()` + `with TestClient(...)` so Starlette's
startup event fires for real: `bootstrap_database` runs the actual Alembic
migrations (0001-0006) against a fresh database and seeds UrbanSpace defaults into
the empty config tables — exactly what happens when the server boots in prod.

Kept in its own file/database so a failure here (migrations, seeding, lifespan
wiring) is never confused with the hermetic unit-test failures elsewhere.
"""
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from fastapi.testclient import TestClient

DBNAME = "athena_boot_smoke"
FIXTURE_DBNAME = "athena_boot_smoke_fx"


def _drop(pg_url: str, dbname: str = DBNAME) -> None:
    admin = create_engine(make_url(pg_url).set(database="postgres"), isolation_level="AUTOCOMMIT")
    try:
        with admin.connect() as conn:
            conn.execute(text(f'DROP DATABASE IF EXISTS "{dbname}" WITH (FORCE)'))
    finally:
        admin.dispose()


def test_boot_smoke(pg_url, monkeypatch):
    url = make_url(pg_url).set(database=DBNAME).render_as_string(hide_password=False)
    # Isolate the fixture DB too: SOURCE_MODE=fixture routes the app to FIXTURE_DATABASE_URL,
    # so pin it to a throwaway (else it would read the developer's real .env fixture DB).
    # This also exercises the two-DB bootstrap end-to-end.
    fx_url = make_url(pg_url).set(database=FIXTURE_DBNAME).render_as_string(hide_password=False)
    monkeypatch.setenv("DATABASE_URL", url)
    monkeypatch.setenv("FIXTURE_DATABASE_URL", fx_url)
    monkeypatch.setenv("SOURCE_MODE", "fixture")
    monkeypatch.setenv("DB_AUTO_CREATE", "true")

    _drop(pg_url, DBNAME)
    _drop(pg_url, FIXTURE_DBNAME)
    try:
        from athena.api.app import create_app

        with TestClient(create_app()) as client:
            # lifespan startup already ran: bootstrap_database -> ensure_database,
            # ensure_schema (Alembic 0001-0006), seed_defaults.
            resp = client.get("/health")
            assert resp.status_code == 200
            assert resp.json() == {"status": "ok"}

            agents = client.get("/config/agents")
            assert agents.status_code == 200
            assert agents.json()["count"] == 8

            competitors = client.get("/config/competitors")
            assert competitors.status_code == 200
            assert competitors.json()["count"] == 6  # 2 facebook + 2 instagram + 2 google (Task 8)

            ingest = client.post("/ingest/competitor")
            assert ingest.status_code == 200
            assert ingest.json()["total"] > 0

            posts = client.get("/data/competitor-posts")
            assert posts.status_code == 200
            items = posts.json()["items"]
            assert items
            platforms = {item["platform"] for item in items}
            assert platforms == {"facebook", "instagram"}

            reviews_ingest = client.post("/ingest/competitor_reviews")
            assert reviews_ingest.status_code == 200
            assert reviews_ingest.json()["total"] > 0

            reviews = client.get("/data/competitor-reviews")
            assert reviews.status_code == 200
            assert reviews.json()["items"]
    finally:
        _drop(pg_url, DBNAME)
        _drop(pg_url, FIXTURE_DBNAME)
