from pydantic_settings import BaseSettings, SettingsConfigDict

KNOWN_SOURCES = ("meta", "google_reviews", "google_ads", "zoho", "google_places")
_KNOWN_SOURCES = set(KNOWN_SOURCES)

# Sources authenticating with a Google OAuth refresh token, each resolved separately by
# google_refresh_token_for. google_places is absent deliberately: it uses an API key.
GOOGLE_OAUTH_SOURCES = ("google_reviews", "google_ads")
_GOOGLE_OAUTH_SOURCES = set(GOOGLE_OAUTH_SOURCES)


class Settings(BaseSettings):
    # env_ignore_empty: bare-key env files (VAR= with no value, as in .env.example) must
    # fall back to the documented defaults instead of overriding them with "" — otherwise
    # `cp .env.example .env` blanks string defaults and crashes on bool fields.
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", env_ignore_empty=True)

    database_url: str = "postgresql+psycopg://athena:athena@localhost:5432/athena"
    # Fixture-mode data lives in its own database so live and fixture rows never share
    # tables. Empty -> single-DB behavior (fixture rows fall back into database_url).
    fixture_database_url: str = ""
    source_mode: str = "fixture"          # global default
    log_level: str = "INFO"
    # On startup, auto-create the target database (if missing) and migrate the
    # schema to head. Enable for local/dev and self-hosted servers; disable when
    # the database is pre-provisioned or the app user lacks CREATE DATABASE rights.
    db_auto_create: bool = True

    # Directory containing the built marketing dashboard (frontend/dist). Mounted
    # at "/" when present; resolved relative to the process CWD (repo root in dev,
    # /app in Docker). Empty/missing directory means API-only serving.
    frontend_dist: str = "frontend/dist"

    # Master switch for serving the dashboard at "/". Set false to run API-only
    # even when a built frontend_dist directory exists.
    serve_frontend: bool = True

    # per-source overrides; empty string means "use global"
    meta_source_mode: str = ""
    google_reviews_source_mode: str = ""
    google_ads_source_mode: str = ""
    zoho_source_mode: str = ""
    google_places_source_mode: str = ""

    # feature flags
    competitor_live_access_enabled: bool = False

    # Google OAuth / Business Profile
    # One OAuth client, but a grant per source: the Business Profile owner and the Ads
    # manager account are usually different Google accounts, and one consent screen cannot
    # span two accounts. Where a single account does own both, one consent covers both
    # scopes and its token fills both variables (scripts/google_oauth.py --source both).
    google_reviews_refresh_token: str = ""     # scope: business.manage
    google_ads_refresh_token: str = ""         # scope: adwords
    gbp_account_id: str = ""
    gbp_location_id: str = ""

    # Meta
    meta_page_id: str = ""
    meta_page_token: str = ""
    meta_ig_user_id: str = ""
    # Google OAuth (shared by reviews + ads)
    google_oauth_client_id: str = ""
    google_oauth_client_secret: str = ""
    # Google Ads
    gads_developer_token: str = ""
    gads_login_customer_id: str = ""
    gads_customer_id: str = ""
    # Zoho
    zoho_client_id: str = ""
    zoho_client_secret: str = ""
    zoho_refresh_token: str = ""
    zoho_dc: str = "com"
    zoho_module: str = "Call_Logs"                 # confirmed live 2026-07-10 (custom module)
    zoho_transcript_field: str = "Transcript_Text"  # confirmed live; `Transcript` field is empty

    # Google Places API (New) — competitor reviews; API-key auth (not OAuth)
    google_places_api_key: str = ""

    # AI: text (Anthropic Claude)
    claude_api_key: str = ""
    claude_model: str = "claude-sonnet-5"          # latest Sonnet
    llm_mode: str = "fake"                          # fake|live

    # AI: images (Google Gemini)
    gemini_api_key: str = ""
    gemini_image_model: str = "gemini-2.5-flash-image"
    image_mode: str = "fake"                        # fake|live

    # Canva Connect
    canva_mode: str = "fake"                       # fake|live
    canva_client_id: str = ""                      # used by the token auto-refresh flow
    canva_client_secret: str = ""                  # used by the token auto-refresh flow
    canva_access_token: str = ""                   # pre-provisioned token the live client uses today
    canva_refresh_token: str = ""                  # for the future auto-refresh flow (rotating token)

    def source_mode_for(self, source: str) -> str:
        if source not in _KNOWN_SOURCES:
            raise ValueError(f"unknown source: {source!r}")
        # Fixture mode serves the fixture database (see active_database_url), which must
        # contain ONLY fixture data — so every source ingests fixtures regardless of its
        # per-source override. Per-source overrides therefore take effect only in live
        # mode, where they let a source fall back to fixtures (e.g. no live creds yet).
        # This is what makes "switch to fixture" actually yield fixture data rather than
        # leaking a live-pinned source (e.g. ZOHO_SOURCE_MODE=live) into the fixture DB.
        if self.source_mode == "fixture":
            return "fixture"
        override = getattr(self, f"{source}_source_mode", "")
        return override or self.source_mode

    def ingestion_skipped_for(self, source: str) -> bool:
        """True when ingestion for `source` must be skipped. Only the degenerate
        single-DB config skips: global live mode with a fixture-pinned source and NO
        fixture_database_url — ingesting would write fixture rows into the live DB.
        With a fixture DB configured the source is routed there instead (see
        database_url_for); fixture global mode never skips."""
        return (self.source_mode == "live"
                and self.source_mode_for(source) == "fixture"
                and not self.fixture_database_url)

    def database_url_for(self, source: str) -> str:
        """The DB serving `source` right now: effective fixture mode routes to the
        fixture DB (when configured), live to the live DB. This is what lets a global
        live mode serve live and fixture sources side by side while each database
        holds only its own kind of rows."""
        if self.source_mode_for(source) == "fixture" and self.fixture_database_url:
            return self.fixture_database_url
        return self.database_url

    def active_database_url(self) -> str:
        """The DB for config/app tables (competitors, agents, drafts, …) and the
        default session bind. Fixture mode uses fixture_database_url when set;
        otherwise (and always in live mode) database_url. Sourced tables are routed
        per source via database_url_for instead."""
        if self.source_mode == "fixture" and self.fixture_database_url:
            return self.fixture_database_url
        return self.database_url

    def google_refresh_token_for(self, source: str) -> str:
        """The refresh token serving `source`. Reviews and ads hold separate grants: they
        need different OAuth scopes (business.manage vs adwords) and those consents
        commonly belong to different Google accounts — the profile owner's and the ad
        manager's — which no single consent screen can cover. One account owning both
        still gets one consent, whose token simply fills both variables. Mint them with
        backend/scripts/google_oauth.py."""
        if source not in _GOOGLE_OAUTH_SOURCES:
            raise ValueError(f"source does not use google oauth: {source!r}")
        return getattr(self, f"{source}_refresh_token")
