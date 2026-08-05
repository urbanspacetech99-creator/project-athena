import os
from pathlib import Path

import pytest


def _test_db_url() -> str | None:
    """Docker-free DB tests: TEST_DATABASE_URL (env var, or a line in .env) must point
    at a DEDICATED empty database — the session fixture create_all/drop_alls every
    table per test. Unset -> testcontainers spins up a disposable Postgres as before."""
    url = os.getenv("TEST_DATABASE_URL", "").strip()
    if url:
        return url
    env_file = Path(__file__).resolve().parent.parent / ".env"
    if env_file.is_file():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            if line.startswith("TEST_DATABASE_URL="):
                value = line.split("=", 1)[1].strip()
                if value:
                    return value
    return None


@pytest.fixture(autouse=True)
def _hermetic_modes(monkeypatch):
    """Keep the suite independent of the developer's local .env.

    Settings() reads .env, so a live-mode .env (e.g. LLM_MODE=live, ZOHO_SOURCE_MODE=live)
    would otherwise leak into unit tests and even trigger real API calls. Force every
    run to fixture/fake mode; tests that need live behaviour pass it explicitly.
    """
    monkeypatch.setenv("SOURCE_MODE", "fixture")
    # Settings uses env_ignore_empty=True, so an EMPTY env var would be ignored and the
    # developer's .env value (e.g. ZOHO_SOURCE_MODE=live) would leak through. Pin each
    # per-source override to a non-empty "fixture" instead.
    for k in ("META_SOURCE_MODE", "GOOGLE_REVIEWS_SOURCE_MODE",
              "GOOGLE_ADS_SOURCE_MODE", "ZOHO_SOURCE_MODE",
              "GOOGLE_PLACES_SOURCE_MODE"):
        monkeypatch.setenv(k, "fixture")
    monkeypatch.setenv("LLM_MODE", "fake")
    monkeypatch.setenv("IMAGE_MODE", "fake")
    monkeypatch.setenv("CANVA_MODE", "fake")


@pytest.fixture
def env(monkeypatch):
    """Set core env vars for a test and return a mutator."""
    def _set(**kwargs):
        for k, v in kwargs.items():
            monkeypatch.setenv(k, str(v))
    _set(
        DATABASE_URL="postgresql+psycopg://u:p@localhost:5432/db",
        SOURCE_MODE="fixture",
        LOG_LEVEL="INFO",
    )
    return _set


@pytest.fixture(scope="session")
def pg_url():
    url = _test_db_url()
    if url:
        yield url
        return
    from testcontainers.postgres import PostgresContainer
    with PostgresContainer("postgres:16-alpine", driver="psycopg") as pg:
        yield pg.get_connection_url()


@pytest.fixture
def session(pg_url):
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session
    from athena.db.base import Base
    from athena.db.seed import seed_defaults
    engine = create_engine(pg_url)
    Base.metadata.create_all(engine)
    with Session(engine) as s:
        seed_defaults(s)
        yield s
    Base.metadata.drop_all(engine)


@pytest.fixture
def two_dbs(pg_url):
    """Two-DB routing harness. Live DB = pg_url (default schema); fixture DB = the same
    database through a distinct URL pinning search_path to schema fx (the test server's
    auth only admits the pre-provisioned athena_* databases, and routing only needs two
    URLs that resolve to two distinct engines whose statements land in provably
    different places). Yields raw engines for out-of-band verification."""
    from sqlalchemy import create_engine, text
    from sqlalchemy.engine import make_url
    from athena.db.base import Base

    def _ensure_schema(url: str, schema: str) -> None:
        admin = create_engine(make_url(url), isolation_level="AUTOCOMMIT")
        try:
            with admin.connect() as conn:
                conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{schema}"'))
        finally:
            admin.dispose()

    # render_as_string(hide_password=False): plain str(URL) masks the password
    fx_url = (make_url(pg_url).update_query_dict({"options": "-csearch_path=fx"})
              .render_as_string(hide_password=False))
    _ensure_schema(pg_url, "fx")
    live, fx = create_engine(pg_url), create_engine(fx_url)
    Base.metadata.create_all(live)
    Base.metadata.create_all(fx)
    yield {"live_url": pg_url, "fx_url": fx_url, "live": live, "fx": fx}
    Base.metadata.drop_all(live)
    Base.metadata.drop_all(fx)
    live.dispose()
    fx.dispose()
    # Also evict the routed factories' cached engines: their pooled connections would
    # otherwise span this drop_all and go stale (psycopg prepared statements).
    from athena.db.base import _engines
    for url in (pg_url, fx_url):
        cached = _engines.pop(url, None)
        if cached is not None:
            cached.dispose()


@pytest.fixture
def routed_settings(two_dbs):
    """Builder for live-global Settings with reviews/ads/places pinned fixture, wired to
    the two_dbs URLs. Every per-source mode is passed as an init arg: the hermetic env
    fixture pins them all to "fixture" in the environment, and init args are the only
    reliable override."""
    from athena.config import Settings

    def _build(**overrides):
        modes = dict(source_mode="live", meta_source_mode="live", zoho_source_mode="live",
                     google_reviews_source_mode="fixture", google_ads_source_mode="fixture",
                     google_places_source_mode="fixture")
        modes.update(overrides)
        return Settings(_env_file=None, database_url=two_dbs["live_url"],
                        fixture_database_url=two_dbs["fx_url"], **modes)
    return _build
