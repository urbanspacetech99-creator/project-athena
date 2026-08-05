#!/usr/bin/env python
"""Mint a Google refresh token for the reviews and/or ads source (OAuth desktop flow).

WHEN TO USE THIS
================
Two live adapters authenticate with a Google refresh token, and they need DIFFERENT
OAuth scopes:

    google_reviews   backend/src/athena/adapters/google_reviews.py   business.manage
    google_ads       backend/src/athena/adapters/google_ads.py       adwords

They are separate grants because they are usually separate *accounts*: the Business
Profile is consented by whoever owns the listing, the Ads manager account by whoever runs
the advertising. One consent screen cannot span two Google accounts, so run this script
once per source and paste each token into its own variable:

    GOOGLE_REVIEWS_REFRESH_TOKEN=...     # --source google_reviews
    GOOGLE_ADS_REFRESH_TOKEN=...         # --source google_ads

Where ONE account really does own both, `--source both` requests the two scopes in a
single consent and prints the resulting token for BOTH variables — a token carrying both
scopes authenticates either source, so there is no third variable to set.

Google refresh tokens do not rotate — mint once per account, then reuse until revoked.
There is no DB persistence here (unlike backend/scripts/canva_oauth.py, whose tokens do
rotate); this script only prints.

WHAT YOU NEED FIRST
===================
1. A Google Cloud project with the APIs you intend to call ENABLED:
     - reviews -> "Google My Business API" (the legacy v4 surface; reviews live only
       there) and Basic API Access approved for the project. A project without that
       approval shows 0 QPM quota and every call 403s no matter how good the token is.
     - ads     -> no API enablement, but the Ads developer token must be approved
       separately (GADS_DEVELOPER_TOKEN).
2. An OAuth 2.0 client of type **Desktop app** (Cloud Console -> APIs & Services ->
   Credentials -> Create credentials -> OAuth client ID). Desktop clients accept the
   loopback redirect this script uses. If you are stuck with a "Web application" client
   instead, register the exact redirect URI printed below on it, or pass --redirect-uri.
   The id/secret go in `.env` as GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET;
   this script reads them from, in order:
     - CLI flags  --client-id / --client-secret
     - env vars / `.env`  via athena.config.Settings
3. The consent screen must list the scope you are requesting, and while the app is in
   "Testing" the consenting account must be added as a Test user.

HOW TO RUN
==========
From `backend/`, with the client id/secret already in `.env`:

    uv run python scripts/google_oauth.py --source google_reviews
    uv run python scripts/google_oauth.py --source google_ads

Sign in as the account that owns THAT surface — the whole point of two runs is that they
are two different accounts. The script opens a browser, catches the redirect on a local
one-shot server, exchanges the code, verifies the granted scopes, and prints the `.env`
line to paste. It never writes `.env`.

WHY access_type=offline AND prompt=consent
==========================================
Google returns a refresh_token only with access_type=offline, and then only on an
account's FIRST authorization of the client. Re-running for an account that already
consented returns an access token with NO refresh token — the failure that makes people
think the flow is broken. prompt=consent (sent by default here) forces the consent screen
every time, so a re-run always yields a fresh refresh token. Pass --no-force-consent to
suppress it if you specifically want Google's default behaviour.

Official reference: https://developers.google.com/identity/protocols/oauth2/native-app
Verified against the Google Identity OAuth docs on 2026-08-03.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import secrets
import sys
import urllib.parse
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer

# Imported so this helper and the runtime auth path can never drift on the scope strings
# or the token endpoint. REQUIRED_SCOPES[source][0] is the scope to REQUEST; any further
# entries are deprecated aliases the runtime still accepts but nobody should mint anew.
try:
    from athena.adapters.google_auth import REQUIRED_SCOPES, TOKEN_URL
except Exception:  # pragma: no cover - allow running before the package is importable
    TOKEN_URL = "https://oauth2.googleapis.com/token"
    REQUIRED_SCOPES = {
        "google_reviews": ("https://www.googleapis.com/auth/business.manage",),
        "google_ads": ("https://www.googleapis.com/auth/adwords",),
    }

AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
DEFAULT_REDIRECT = "http://127.0.0.1:8913"

_REVIEWS_SCOPE = REQUIRED_SCOPES["google_reviews"][0]
_ADS_SCOPE = REQUIRED_SCOPES["google_ads"][0]

# --source -> (scopes to request, env vars to paste the resulting token into). "both" is
# one account consenting to both scopes at once, so its single token fills both variables.
TARGETS = {
    "google_reviews": ((_REVIEWS_SCOPE,), ("GOOGLE_REVIEWS_REFRESH_TOKEN",)),
    "google_ads": ((_ADS_SCOPE,), ("GOOGLE_ADS_REFRESH_TOKEN",)),
    "both": ((_REVIEWS_SCOPE, _ADS_SCOPE),
             ("GOOGLE_REVIEWS_REFRESH_TOKEN", "GOOGLE_ADS_REFRESH_TOKEN")),
}

# Google error code -> what to actually do about it. The token endpoint pairs these with an
# error_description that is often vaguer than the code itself.
ERROR_HINTS = {
    "invalid_grant": "the authorization code expired (~10 min), was already used, or the "
                     "redirect_uri differs from the one in the authorize step. Re-run.",
    "invalid_client": "client id/secret do not match a client in this project - re-copy both "
                      "from Cloud Console -> Credentials, and check it is a Desktop app client.",
    "redirect_uri_mismatch": "the redirect URI is not registered on this client. Use a Desktop "
                             "app client, or register the exact URI printed above.",
    "invalid_scope": "the scope is not enabled on the consent screen, or the API is not enabled "
                     "in the project.",
    "access_denied": "consent was refused, or the account is not a Test user on a consent "
                     "screen still in Testing.",
}


def make_pkce() -> tuple[str, str]:
    """Return (code_verifier, code_challenge). Verifier: 43-128 chars from the unreserved
    set. Challenge: URL-safe base64 of SHA-256(verifier), no padding. Per RFC 7636."""
    verifier = secrets.token_urlsafe(64)  # ~86 url-safe chars, within 43-128
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    challenge = base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")
    return verifier, challenge


def build_authorize_url(client_id: str, redirect_uri: str, scopes: tuple[str, ...],
                        challenge: str, state: str, force_consent: bool) -> str:
    params = {
        "response_type": "code",
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "scope": " ".join(scopes),
        "code_challenge": challenge,
        "code_challenge_method": "S256",
        "state": state,
        "access_type": "offline",     # without this Google issues no refresh token at all
    }
    if force_consent:
        params["prompt"] = "consent"  # without this a repeat authorization omits it too
    return f"{AUTHORIZE_URL}?{urllib.parse.urlencode(params)}"


def capture_code_via_server(redirect_uri: str, expected_state: str) -> str:
    """Run a one-shot HTTP server on the redirect URI's host:port and return the `code`.
    Raises on an OAuth error, a state mismatch, or a missing code."""
    parsed = urllib.parse.urlparse(redirect_uri)
    host = parsed.hostname or "127.0.0.1"
    port = parsed.port or 80
    captured: dict[str, str] = {}

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):  # noqa: N802 - stdlib signature
            qs = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            captured.update({k: v[0] for k, v in qs.items()})
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            ok = "code" in captured and "error" not in captured
            msg = ("Google authorisation received. You can close this tab and return to "
                   "the terminal." if ok else
                   f"Authorisation failed: {captured.get('error_description') or captured.get('error')}")
            self.wfile.write(f"<html><body><h3>{msg}</h3></body></html>".encode())

        def log_message(self, *_args):  # silence the default stderr access log
            pass

    server = HTTPServer((host, port), Handler)
    print(f"Listening on http://{host}:{port} for the Google redirect ...")
    try:
        server.handle_request()  # blocks until exactly one request
    finally:
        server.server_close()
    return _extract_code(captured, expected_state)


def capture_code_manually(expected_state: str) -> str:
    """Fallback for non-loopback redirect URIs: user pastes the full redirect URL."""
    pasted = input("\nPaste the FULL redirect URL you landed on (or just the ?code=... query): ").strip()
    query = urllib.parse.urlparse(pasted).query or pasted.lstrip("?")
    captured = {k: v[0] for k, v in urllib.parse.parse_qs(query).items()}
    return _extract_code(captured, expected_state)


def _extract_code(captured: dict[str, str], expected_state: str) -> str:
    if captured.get("error"):
        err = captured["error"]
        lines = [f"Google returned an error: {err} - {captured.get('error_description', '')}"]
        if err in ERROR_HINTS:
            lines.append(f"  -> {ERROR_HINTS[err]}")
        raise SystemExit("\n".join(lines))
    if not captured.get("code"):
        raise SystemExit(f"No authorization code in the redirect (got keys: {list(captured)}).")
    if captured.get("state") != expected_state:
        raise SystemExit("state mismatch - possible CSRF; aborting. Re-run the flow.")
    return captured["code"]


def exchange_code(client_id: str, client_secret: str, code: str,
                  code_verifier: str, redirect_uri: str) -> dict:
    """POST the authorization code to Google's token endpoint. Returns the parsed JSON
    (access_token, refresh_token, scope, ...). Exits with a readable message on error."""
    import httpx

    try:
        resp = httpx.post(TOKEN_URL, data={
            "grant_type": "authorization_code",
            "code": code,
            "client_id": client_id,
            "client_secret": client_secret,
            "code_verifier": code_verifier,
            "redirect_uri": redirect_uri,
        }, timeout=30.0)
    except httpx.HTTPError as exc:
        raise SystemExit(f"network error calling {TOKEN_URL}: {exc}")
    try:
        body = resp.json()
    except ValueError:
        raise SystemExit(f"non-JSON response from {TOKEN_URL} ({resp.status_code}): {resp.text[:400]}")
    err = body.get("error") if isinstance(body, dict) else None
    if err or resp.status_code >= 400:
        lines = [f"Google token endpoint error (HTTP {resp.status_code}): "
                 f"{err} - {body.get('error_description', '') if isinstance(body, dict) else body}"]
        if err in ERROR_HINTS:
            lines.append(f"  -> {ERROR_HINTS[err]}")
        raise SystemExit("\n".join(lines))
    return body


def resolve_credentials(args) -> tuple[str, str]:
    """Flags first, then athena.config.Settings (env vars / `.env`)."""
    client_id, client_secret = args.client_id, args.client_secret
    settings_error = ""
    if not (client_id and client_secret):
        try:
            from athena.config import Settings
            s = Settings()
            client_id = client_id or s.google_oauth_client_id
            client_secret = client_secret or s.google_oauth_client_secret
        except Exception as exc:  # pragma: no cover - allow running before the package imports
            settings_error = f"\n(note: loading athena.config.Settings failed: {exc})"
    if not client_id or not client_secret:
        raise SystemExit(
            "Missing client id/secret. Pass --client-id/--client-secret, set "
            "GOOGLE_OAUTH_CLIENT_ID/GOOGLE_OAUTH_CLIENT_SECRET in the environment, or put "
            "them in .env." + settings_error)
    return client_id, client_secret


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(
        description="Mint a Google refresh token for the reviews and/or ads source "
                    "(printed, never written to .env).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="See the module docstring (top of this file) for the full setup checklist.")
    p.add_argument("--source", choices=sorted(TARGETS), default="google_reviews",
                   help="Which grant to mint: google_reviews (business.manage), google_ads "
                        "(adwords), or both in one consent when a single account owns each "
                        "(default: google_reviews)")
    p.add_argument("--client-id", default="", help="OAuth client id (else env/.env)")
    p.add_argument("--client-secret", default="", help="OAuth client secret (else env/.env)")
    p.add_argument("--redirect-uri", default=DEFAULT_REDIRECT,
                   help=f"Loopback URI a Desktop app client accepts (default: {DEFAULT_REDIRECT})")
    p.add_argument("--manual", action="store_true",
                   help="Do not start a local server; paste the redirect URL yourself")
    p.add_argument("--no-browser", action="store_true", help="Do not auto-open the browser")
    p.add_argument("--no-force-consent", action="store_true",
                   help="Omit prompt=consent (a re-authorizing account then gets NO refresh token)")
    args = p.parse_args(argv)

    scopes, env_vars = TARGETS[args.source]
    client_id, client_secret = resolve_credentials(args)
    verifier, challenge = make_pkce()
    state = secrets.token_urlsafe(24)
    auth_url = build_authorize_url(client_id, args.redirect_uri, scopes, challenge, state,
                                   force_consent=not args.no_force_consent)

    print(f"Minting the {args.source} grant with client {client_id[:16]}...")
    print(f"Scopes: {' '.join(scopes)}")
    if args.source == "both":
        print("NOTE: one consent for both scopes only works when ONE account owns the "
              "Business Profile AND the Ads manager account.")
    print("\n1) Authorise in your browser, signing in as the account that owns this surface:\n")
    print(f"   {auth_url}\n")
    if not args.no_browser:
        try:
            webbrowser.open(auth_url)
        except Exception:
            pass

    code = capture_code_manually(state) if args.manual else \
        capture_code_via_server(args.redirect_uri, state)

    print("\n2) Exchanging the authorization code for tokens ...")
    tokens = exchange_code(client_id, client_secret, code, verifier, args.redirect_uri)

    refresh_token = tokens.get("refresh_token", "")
    if not refresh_token:
        raise SystemExit(
            "Google returned an access token but NO refresh token.\n"
            "  -> This account has already authorized this client. Re-run WITHOUT "
            "--no-force-consent, or revoke the app at "
            "https://myaccount.google.com/permissions and try again.")

    granted = (tokens.get("scope") or "").split()
    missing = [s for s in scopes if s not in granted]
    if missing:
        print(f"\nWARNING: consent did not grant {' '.join(missing)} (granted: "
              f"{' '.join(granted) or 'nothing'}). The adapter will reject this token.")

    print("\n=== Google tokens ===")
    print(f"refresh_token: {refresh_token}   (does not rotate; valid until revoked)")
    print(f"access_token:  {tokens.get('access_token', '')}   "
          f"(expires in {tokens.get('expires_in', '?')}s; the adapter mints its own)")
    print(f"scope:         {' '.join(granted)}")

    print("\n=== Paste into .env ===")
    for var in env_vars:
        print(f"{var}={refresh_token}")
    if args.source == "both":
        print("(Same token twice: it carries both scopes, so it authenticates either source.)")
    print("\n(Keep GOOGLE_OAUTH_CLIENT_ID/GOOGLE_OAUTH_CLIENT_SECRET as they are - the "
          "adapter refreshes with all three.)")
    if args.source in ("google_reviews", "both"):
        print("Set GBP_ACCOUNT_ID/GBP_LOCATION_ID too, then GOOGLE_REVIEWS_SOURCE_MODE=live.")
    if args.source in ("google_ads", "both"):
        print("Set GADS_DEVELOPER_TOKEN/GADS_LOGIN_CUSTOMER_ID/GADS_CUSTOMER_ID too, then "
              "GOOGLE_ADS_SOURCE_MODE=live.")

    print("\nDone.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
