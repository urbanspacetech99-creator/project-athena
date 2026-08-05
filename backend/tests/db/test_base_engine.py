from athena.config import Settings
from athena.db.base import make_engine


def test_make_engine_uses_fixture_url_in_fixture_mode(monkeypatch):
    monkeypatch.setenv("SOURCE_MODE", "fixture")
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://u:p@h:5432/live")
    monkeypatch.setenv("FIXTURE_DATABASE_URL", "postgresql+psycopg://u:p@h:5432/fix")
    eng = make_engine(Settings())
    assert eng.url.database == "fix"


def test_make_engine_uses_live_url_in_live_mode(monkeypatch):
    monkeypatch.setenv("SOURCE_MODE", "live")
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://u:p@h:5432/live")
    monkeypatch.setenv("FIXTURE_DATABASE_URL", "postgresql+psycopg://u:p@h:5432/fix")
    eng = make_engine(Settings())
    assert eng.url.database == "live"
