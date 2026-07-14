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


def test_source_mode_for_uses_override(env):
    env(META_SOURCE_MODE="live")
    s = Settings()
    assert s.source_mode_for("meta") == "live"
    assert s.source_mode_for("zoho") == "fixture"


def test_source_mode_for_rejects_unknown_source(env):
    from athena.config import Settings
    import pytest
    s = Settings()
    with pytest.raises(ValueError, match="unknown source"):
        s.source_mode_for("gogle_ads")
