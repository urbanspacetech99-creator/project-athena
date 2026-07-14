from pydantic_settings import BaseSettings, SettingsConfigDict

_KNOWN_SOURCES = {"meta", "google_reviews", "google_ads", "zoho"}


class Settings(BaseSettings):
    # env_ignore_empty: bare-key env files (VAR= with no value, as in .env.example) must
    # fall back to the documented defaults instead of overriding them with "" — otherwise
    # `cp .env.example .env` blanks string defaults and crashes on bool fields.
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", env_ignore_empty=True)

    database_url: str = "postgresql+psycopg://athena:athena@localhost:5432/athena"
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

    # per-source overrides; empty string means "use global"
    meta_source_mode: str = ""
    google_reviews_source_mode: str = ""
    google_ads_source_mode: str = ""
    zoho_source_mode: str = ""

    # feature flags
    competitor_live_access_enabled: bool = False

    # Google OAuth / Business Profile
    google_refresh_token: str = ""
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
        override = getattr(self, f"{source}_source_mode", "")
        return override or self.source_mode
