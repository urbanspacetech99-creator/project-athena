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
