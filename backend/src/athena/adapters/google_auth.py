import httpx

from athena.config import Settings

TOKEN_URL = "https://oauth2.googleapis.com/token"

# The scope each source's grant must carry. Reviews also accepts the deprecated
# plus.business.manage: the v4 reviews endpoint still honours tokens minted under the
# old name, so a legacy grant must not be rejected here (verified against the Business
# Profile OAuth docs 2026-08-03).
REQUIRED_SCOPES = {
    "google_reviews": ("https://www.googleapis.com/auth/business.manage",
                       "https://www.googleapis.com/auth/plus.business.manage"),
    "google_ads": ("https://www.googleapis.com/auth/adwords",),
}
REFRESH_TOKEN_ENV = {"google_reviews": "GOOGLE_REVIEWS_REFRESH_TOKEN",
                     "google_ads": "GOOGLE_ADS_REFRESH_TOKEN"}


def _fix_it(source: str) -> str:
    return (f"set {REFRESH_TOKEN_ENV[source]} - mint one with: "
            f"uv run python scripts/google_oauth.py --source {source}")


def google_access_token(settings: Settings, source: str) -> str:
    """Mint an access token for `source` ("google_reviews" | "google_ads").

    `source` is required, not defaulted: the two APIs resolve different refresh tokens
    (see Settings.google_refresh_token_for), and a default would let a new call site
    silently authenticate against the wrong grant. Passing the caller's own
    `SourceAdapter.source` keeps the two in step.

    A grant carrying the wrong scope is caught here, named, rather than surfacing much
    later as an opaque 403 from the API itself.
    """
    refresh_token = settings.google_refresh_token_for(source)   # validates `source`
    if not refresh_token:
        raise RuntimeError(f"no google refresh token for {source}: {_fix_it(source)}")

    try:
        resp = httpx.post(TOKEN_URL, data={
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "client_id": settings.google_oauth_client_id,
            "client_secret": settings.google_oauth_client_secret,
        }, timeout=30)
    except httpx.HTTPError as exc:
        raise RuntimeError(f"google oauth token endpoint unreachable: {exc}") from exc

    try:
        body = resp.json()
    except ValueError:
        raise RuntimeError(f"google oauth error: non-JSON response for {source} "
                           f"(HTTP {resp.status_code}): {resp.text[:300]}") from None

    # Failures come back as {"error": "...", "error_description": "..."} — a flat string
    # pair, not the nested envelope raise_on_error_envelope handles, and the description
    # carries the actionable half ("Token has been expired or revoked").
    if resp.status_code >= 400 or body.get("error"):
        detail = " ".join(str(p) for p in
                          (body.get("error"), body.get("error_description")) if p)
        raise RuntimeError(f"google oauth error for {source} (HTTP {resp.status_code}): "
                           f"{detail or resp.text[:300]}. If that grant was revoked or "
                           f"belongs to the other Google API, {_fix_it(source)}")

    # Google echoes the granted scopes on a refresh grant, so the commonest misconfiguration
    # — one API's token pasted into the other's variable, or a shared token consented for
    # only one scope — is provable right here instead of at the first real API call.
    granted = (body.get("scope") or "").split()
    accepted = REQUIRED_SCOPES[source]
    if granted and not any(scope in granted for scope in accepted):
        raise RuntimeError(
            f"the refresh token used for {source} was granted [{' '.join(granted)}], which "
            f"does not include {accepted[0]}. That is another Google API's grant: "
            f"{_fix_it(source)}")

    token = body.get("access_token", "")
    if not token:
        raise RuntimeError(f"google oauth returned no access_token for {source}: "
                           f"{_fix_it(source)}")
    return token
