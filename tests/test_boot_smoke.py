"""End-to-end boot smoke test through the real FastAPI lifespan.

Unlike the rest of the suite (which builds its own engine/session via the `session`
fixture), this test drives `create_app()` + `with TestClient(...)` so Starlette's
startup event fires for real: `bootstrap_database` runs the actual Alembic
migrations (0001-0004) against a fresh database and seeds UrbanSpace defaults into
the empty config tables — exactly what happens when the server boots in prod.

Kept in its own file/database so a failure here (migrations, seeding, lifespan
wiring) is never confused with the hermetic unit-test failures elsewhere.
"""
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from fastapi.testclient import TestClient

DBNAME = "athena_boot_smoke"


def _drop(pg_url: str) -> None:
    admin = create_engine(make_url(pg_url).set(database="postgres"), isolation_level="AUTOCOMMIT")
    try:
        with admin.connect() as conn:
            conn.execute(text(f'DROP DATABASE IF EXISTS "{DBNAME}" WITH (FORCE)'))
    finally:
        admin.dispose()


def test_boot_smoke(pg_url, monkeypatch):
    url = make_url(pg_url).set(database=DBNAME).render_as_string(hide_password=False)
    monkeypatch.setenv("DATABASE_URL", url)
    monkeypatch.setenv("SOURCE_MODE", "fixture")
    monkeypatch.setenv("DB_AUTO_CREATE", "true")

    _drop(pg_url)
    try:
        from athena.api.app import create_app

        with TestClient(create_app()) as client:
            # lifespan startup already ran: bootstrap_database -> ensure_database,
            # ensure_schema (Alembic 0001-0004), seed_defaults.
            resp = client.get("/health")
            assert resp.status_code == 200
            assert resp.json() == {"status": "ok"}

            agents = client.get("/config/agents")
            assert agents.status_code == 200
            assert agents.json()["count"] == 8

            competitors = client.get("/config/competitors")
            assert competitors.status_code == 200
            assert competitors.json()["count"] == 4

            ingest = client.post("/ingest/competitor")
            assert ingest.status_code == 200
            assert ingest.json()["total"] > 0

            posts = client.get("/data/competitor-posts")
            assert posts.status_code == 200
            items = posts.json()["items"]
            assert items
            platforms = {item["platform"] for item in items}
            assert platforms == {"facebook", "instagram"}
    finally:
        _drop(pg_url)
