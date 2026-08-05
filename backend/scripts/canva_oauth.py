#!/usr/bin/env python
"""Regenerate a Canva Connect refresh token via the OAuth 2.0 Authorization-Code + PKCE flow.

WHEN TO USE THIS
================
The live Canva client (`backend/src/athena/integrations/canva.py`) keeps a *rotating* refresh token
in the DB `oauth_tokens` row (provider="canva"). Canva refresh tokens are single-use: each
refresh spends the current token and returns a new one. If two processes refresh the same
token concurrently (e.g. two webserver instances), the loser replays an already-spent token
and Canva revokes the whole lineage. That is exactly this error:

    canva token refresh failed  status=400
    {"error":"invalid_grant","error_description":"Token lineage has been revoked"}

Once a lineage is revoked, NO refresh can recover it — you must mint a brand-new
access/refresh token pair through the OAuth consent flow. That is what this script does.

It cannot be fixed by editing tokens by hand: only Canva can issue a valid pair, and only via
a user authorising the integration in the browser.

WHAT YOU NEED FIRST
===================
1. The integration's CLIENT ID and CLIENT SECRET (Canva Developer portal ->
   your integration -> "Configuration"). This script reads them from, in order:
     - CLI flags  --client-id / --client-secret
     - env vars   CANVA_CLIENT_ID / CANVA_CLIENT_SECRET
     - the repo `.env` file (loaded via athena.config.Settings)
2. A REDIRECT URL registered on the integration (Canva Developer portal ->
   your integration -> "Authentication" -> "Add redirect URL"). This script defaults to
       http://127.0.0.1:8080/oauth/redirect
   Add that EXACT string (scheme, host, port, path) to the integration, or pass your own
   with --redirect-uri. Canva only redirects to registered URLs.
3. The integration must have the scopes this app uses enabled (Developer portal -> "Scopes"):
       asset:read  asset:write  design:content:write  design:meta:read
   (see the docstring of CanvaConnectClient in backend/src/athena/integrations/canva.py).

HOW TO RUN
==========
From `backend/`, with client id/secret already in `.env`:

    uv run python scripts/canva_oauth.py

Or pass them explicitly:

    uv run python scripts/canva_oauth.py \
        --client-id  OC-AZxxxxxxxx \
        --client-secret  cnvcaxxxxxxxxxxxxxxxxxxxx

The script will:
  1. Build the authorisation URL (with a PKCE challenge + CSRF `state`) and open your browser.
  2. Spin up a one-shot local server on the redirect URL to catch the `code` Canva sends back.
     (Use --manual if the redirect URL is not localhost; you'll paste the redirect URL yourself.)
  3. Exchange the code for an access token + refresh token at Canva's token endpoint,
     authenticating with HTTP Basic (client_id:client_secret) per the Canva docs.
  4. Persist the new pair into the app DB `oauth_tokens` row (unless --no-persist), so the
     running app picks it up immediately. It also prints the raw tokens.

IMPORTANT: `.env` alone is NOT enough to fix a running app
==========================================================
`CANVA_REFRESH_TOKEN` in `.env` only seeds the DB row when NO row exists yet
(see backend/src/athena/db/seed.py). A revoked deployment already HAS a row, so seeding is skipped and
editing `.env` changes nothing. That is why this script writes straight into the DB row by
default (via the same `save_oauth_token` + `active_database_url()` path the app reads from).
Update `.env`'s CANVA_REFRESH_TOKEN too if you like, as a fresh-install fallback, but the DB
write is what unblocks the current deployment.

The DB it writes to is whatever `Settings().active_database_url()` resolves to for the CURRENT
`.env` (fixture mode -> fixture DB; otherwise database_url). Run this with the same `.env` the
live server uses so the token lands where the server reads it.

AVOIDING A REPEAT REVOCATION
============================
This revocation was caused by concurrent refreshes. The client already takes a `FOR UPDATE`
row lock so multiple workers sharing ONE database serialise safely. The failure mode to avoid
is two instances pointed at DIFFERENT databases (each with its own token row) both refreshing
the same Canva lineage. Keep a single source of truth for the Canva token: one database, or
only one instance in `canva_mode=live`.

Official reference: https://www.canva.dev/docs/connect/authentication/
Verified against the Canva Connect docs on 2026-07-17.
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

# The token endpoint and the scopes the live client needs. Imported so this helper and the
# runtime client can never drift apart.
try:
    from athena.integrations.canva import CANVA_BASE
except Exception:  # pragma: no cover - allow running before the package is importable
    CANVA_BASE = "https://api.canva.com/rest/v1"

AUTHORIZE_URL = "https://www.canva.com/api/oauth/authorize"
TOKEN_URL = f"{CANVA_BASE}/oauth/token"
DEFAULT_REDIRECT = "http://127.0.0.1:8080/oauth/redirect"
DEFAULT_SCOPES = "asset:read asset:write design:content:write design:meta:read"


def make_pkce() -> tuple[str, str]:
    """Return (code_verifier, code_challenge). Verifier: 43-128 chars from the unreserved
    set. Challenge: URL-safe base64 of SHA-256(verifier), no padding. Per RFC 7636 / Canva."""
    verifier = secrets.token_urlsafe(64)  # ~86 url-safe chars, within 43-128
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    challenge = base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")
    return verifier, challenge


def build_authorize_url(client_id: str, redirect_uri: str, scopes: str,
                        challenge: str, state: str) -> str:
    params = {
        "response_type": "code",
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "scope": scopes,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
        "state": state,
    }
    return f"{AUTHORIZE_URL}?{urllib.parse.urlencode(params)}"


def capture_code_via_server(redirect_uri: str, expected_state: str) -> str:
    """Run a one-shot HTTP server on the redirect URL's host:port and return the `code`.
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
            msg = ("Canva authorisation received. You can close this tab and return to the "
                   "terminal." if ok else
                   f"Authorisation failed: {captured.get('error_description') or captured.get('error')}")
            self.wfile.write(f"<html><body><h3>{msg}</h3></body></html>".encode())

        def log_message(self, *_args):  # silence the default stderr access log
            pass

    server = HTTPServer((host, port), Handler)
    print(f"Listening on http://{host}:{port} for the Canva redirect ...")
    try:
        server.handle_request()  # blocks until exactly one request
    finally:
        server.server_close()
    return _extract_code(captured, expected_state)


def capture_code_manually(expected_state: str) -> str:
    """Fallback for non-localhost redirect URLs: user pastes the full redirect URL."""
    pasted = input("\nPaste the FULL redirect URL you landed on (or just the ?code=... query): ").strip()
    query = urllib.parse.urlparse(pasted).query or pasted.lstrip("?")
    captured = {k: v[0] for k, v in urllib.parse.parse_qs(query).items()}
    return _extract_code(captured, expected_state)


def _extract_code(captured: dict[str, str], expected_state: str) -> str:
    if captured.get("error"):
        raise SystemExit(f"Canva returned an error: {captured.get('error')} - "
                         f"{captured.get('error_description')}")
    if not captured.get("code"):
        raise SystemExit(f"No authorization code in the redirect (got keys: {list(captured)}).")
    if captured.get("state") != expected_state:
        raise SystemExit("state mismatch - possible CSRF; aborting. Re-run the flow.")
    return captured["code"]


def exchange_code(client_id: str, client_secret: str, code: str,
                  code_verifier: str, redirect_uri: str) -> dict:
    """POST the authorization code to Canva's token endpoint. Auth is HTTP Basic
    (client_id:client_secret). Returns the parsed JSON (access_token, refresh_token, ...)."""
    import httpx

    resp = httpx.post(
        TOKEN_URL,
        auth=(client_id, client_secret),
        data={
            "grant_type": "authorization_code",
            "code": code,
            "code_verifier": code_verifier,
            "redirect_uri": redirect_uri,
        },
        timeout=30.0,
    )
    if resp.status_code >= 400:
        raise SystemExit(f"Token exchange failed ({resp.status_code}): {resp.text}")
    return resp.json()


def persist_to_db(access_token: str, refresh_token: str, expires_in: int) -> str:
    """Upsert the new pair into the app DB `oauth_tokens` row (provider="canva"), the same
    place the live client reads from. Returns the DB URL written to."""
    from datetime import datetime, timedelta, timezone

    from athena.config import Settings
    from athena.db.base import make_session_factory
    from athena.integrations.token_store import save_oauth_token

    settings = Settings()
    db_url = settings.active_database_url()
    session = make_session_factory()()
    try:
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=int(expires_in))
        save_oauth_token(session, "canva", access_token=access_token,
                         refresh_token=refresh_token, expires_at=expires_at)
    finally:
        session.close()
    return db_url


def resolve_credentials(args) -> tuple[str, str]:
    client_id = args.client_id
    client_secret = args.client_secret
    if not client_id or not client_secret:
        try:
            from athena.config import Settings
            s = Settings()
            client_id = client_id or s.canva_client_id
            client_secret = client_secret or s.canva_client_secret
        except Exception:
            pass
    if not client_id or not client_secret:
        raise SystemExit(
            "Missing client id/secret. Pass --client-id/--client-secret, set "
            "CANVA_CLIENT_ID/CANVA_CLIENT_SECRET, or put them in .env.")
    return client_id, client_secret


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(
        description="Regenerate a Canva Connect refresh token via OAuth (Authorization Code + PKCE).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="See the module docstring (top of this file) for the full setup checklist.")
    p.add_argument("--client-id", default="", help="Canva integration client id (else env/.env)")
    p.add_argument("--client-secret", default="", help="Canva integration client secret (else env/.env)")
    p.add_argument("--redirect-uri", default=DEFAULT_REDIRECT,
                   help=f"Must be registered on the integration (default: {DEFAULT_REDIRECT})")
    p.add_argument("--scopes", default=DEFAULT_SCOPES, help=f"Space-separated (default: {DEFAULT_SCOPES})")
    p.add_argument("--manual", action="store_true",
                   help="Do not start a local server; paste the redirect URL yourself "
                        "(use for non-localhost redirect URLs)")
    p.add_argument("--no-persist", action="store_true",
                   help="Do not write the new tokens into the app DB; only print them")
    p.add_argument("--no-browser", action="store_true", help="Do not auto-open the browser")
    args = p.parse_args(argv)

    client_id, client_secret = resolve_credentials(args)
    verifier, challenge = make_pkce()
    state = secrets.token_urlsafe(24)
    auth_url = build_authorize_url(client_id, args.redirect_uri, args.scopes, challenge, state)

    print("\n1) Authorise the integration in your browser:\n")
    print(f"   {auth_url}\n")
    if not args.no_browser:
        try:
            webbrowser.open(auth_url)
        except Exception:
            pass

    if args.manual:
        code = capture_code_manually(state)
    else:
        code = capture_code_via_server(args.redirect_uri, state)

    print("\n2) Exchanging the authorization code for tokens ...")
    tokens = exchange_code(client_id, client_secret, code, verifier, args.redirect_uri)
    access_token = tokens["access_token"]
    refresh_token = tokens["refresh_token"]
    expires_in = tokens.get("expires_in", 14400)

    print("\n=== New Canva tokens ===")
    print(f"access_token:  {access_token}")
    print(f"refresh_token: {refresh_token}")
    print(f"expires_in:    {expires_in} seconds")
    print(f"scope:         {tokens.get('scope', args.scopes)}")

    if args.no_persist:
        print("\n(--no-persist) Not writing to the DB. Update the app yourself:")
        print("  - Preferred: write these into the oauth_tokens row (provider='canva').")
        print("  - .env CANVA_REFRESH_TOKEN only seeds when NO row exists (fresh installs).")
    else:
        db_url = persist_to_db(access_token, refresh_token, expires_in)
        print(f"\n3) Persisted to the app DB oauth_tokens row (provider='canva') at:\n   {db_url}")
        print("   The running live app will use the new token on its next Canva call.")
        print("   Also set CANVA_REFRESH_TOKEN in .env for fresh-install seeding, if you wish.")

    print("\nDone.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
