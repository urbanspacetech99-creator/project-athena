import re
from pathlib import Path

from athena.config import Settings

_ENV_EXAMPLE = Path(__file__).resolve().parents[1] / ".env.example"


def test_settings_reads_core_env(env):
    s = Settings()
    assert s.source_mode == "fixture"
    assert s.log_level == "INFO"
    assert "postgresql" in s.database_url


def test_source_mode_for_falls_back_to_global(env):
    # An explicit empty override (the field default) must fall back to the global
    # mode. Passed as an init arg: empty ENV vars are ignored (env_ignore_empty).
    s = Settings(meta_source_mode="")
    assert s.source_mode_for("meta") == "fixture"


def test_empty_env_values_keep_defaults(monkeypatch):
    """Simulate `cp .env.example .env`: every documented var present but EMPTY.

    env_ignore_empty=True must let the documented defaults win — no crash on the
    bool fields, no silently-blanked string defaults. Env vars and the dotenv file
    share the same empty-value handling in pydantic-settings, so real (monkeypatched)
    empty env vars cover the code path; `_env_file=None` keeps the developer's
    actual .env out of the test.
    """
    names = re.findall(r"^([A-Z][A-Z0-9_]*)=", _ENV_EXAMPLE.read_text(), flags=re.M)
    assert len(names) >= 30  # sanity: the parse really found the documented vars
    for name in names:
        monkeypatch.setenv(name, "")
    s = Settings(_env_file=None)
    assert s.source_mode == "fixture"
    assert s.db_auto_create is True
    assert s.competitor_live_access_enabled is False
    assert s.llm_mode == "fake"
    assert s.claude_model == "claude-sonnet-5"
    assert s.gemini_image_model == "gemini-2.5-flash-image"
    assert s.zoho_module == "Call_Logs"
    assert s.zoho_dc == "com"


def test_source_mode_for_override_applies_in_live_mode():
    # In live mode a per-source override can downgrade one source to fixtures (fallback
    # for a source without live credentials) while the rest stay live. Built with
    # _env_file=None so the developer's .env / hermetic fixture can't leak in.
    s = Settings(_env_file=None, source_mode="live",
                 meta_source_mode="fixture", zoho_source_mode="")
    assert s.source_mode_for("meta") == "fixture"
    assert s.source_mode_for("zoho") == "live"


def test_source_mode_for_fixture_global_forces_fixture():
    # Fixture mode serves the fixture DB, which must stay pure: a live-pinned source must
    # NOT leak live data into it, so the override is ignored under a fixture global mode.
    s = Settings(_env_file=None, source_mode="fixture", zoho_source_mode="live")
    assert s.source_mode_for("zoho") == "fixture"
    assert s.source_mode_for("meta") == "fixture"


def test_active_database_url_fixture_mode(monkeypatch):
    monkeypatch.setenv("SOURCE_MODE", "fixture")
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://u:p@h:5432/live")
    monkeypatch.setenv("FIXTURE_DATABASE_URL", "postgresql+psycopg://u:p@h:5432/fix")
    assert Settings().active_database_url() == "postgresql+psycopg://u:p@h:5432/fix"


def test_active_database_url_live_mode(monkeypatch):
    monkeypatch.setenv("SOURCE_MODE", "live")
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://u:p@h:5432/live")
    monkeypatch.setenv("FIXTURE_DATABASE_URL", "postgresql+psycopg://u:p@h:5432/fix")
    assert Settings().active_database_url() == "postgresql+psycopg://u:p@h:5432/live"


def test_active_database_url_falls_back_when_no_fixture_url():
    # env_ignore_empty=True means an empty FIXTURE_DATABASE_URL env var is ignored and the
    # field default ("") applies -> fall back to database_url. Build Settings directly with
    # _env_file=None so the developer's real .env (which sets a fixture URL) can't leak in.
    s = Settings(_env_file=None, source_mode="fixture", fixture_database_url="",
                 database_url="postgresql+psycopg://u:p@h:5432/live")
    assert s.active_database_url() == "postgresql+psycopg://u:p@h:5432/live"


def test_source_mode_for_rejects_unknown_source(env):
    from athena.config import Settings
    import pytest
    s = Settings()
    with pytest.raises(ValueError, match="unknown source"):
        s.source_mode_for("gogle_ads")
