import httpx

from athena.config import Settings

TOKEN_URL = "https://oauth2.googleapis.com/token"


def google_access_token(settings: Settings) -> str:
    resp = httpx.post(TOKEN_URL, data={
        "grant_type": "refresh_token",
        "refresh_token": getattr(settings, "google_refresh_token", "") or "",
        "client_id": getattr(settings, "google_oauth_client_id", "") or "",
        "client_secret": getattr(settings, "google_oauth_client_secret", "") or "",
    }, timeout=30)
    resp.raise_for_status()
    return resp.json().get("access_token", "")
