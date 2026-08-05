#!/usr/bin/env python
"""Exchange a Zoho self-client grant code for a ZOHO_REFRESH_TOKEN.

WHEN TO USE THIS
================
The live Zoho adapter (`backend/src/athena/adapters/zoho.py`) authenticates with a refresh token
read from settings on every fetch:

    ZOHO_CLIENT_ID       the self client's id
    ZOHO_CLIENT_SECRET   the self client's secret
    ZOHO_REFRESH_TOKEN   what this script mints

Zoho refresh tokens do not rotate and do not expire — once minted, the same token works
until it is revoked. So you run this script exactly once per self client (or again after a
revocation) and paste the result into `.env`. There is no DB persistence and no ongoing
refresh bookkeeping (unlike Canva, see backend/scripts/canva_oauth.py).

WHAT YOU NEED FIRST
===================
1. A Self Client in the Zoho API console (https://api-console.zoho.com -> "Self Client").
   Its CLIENT ID and CLIENT SECRET go in `.env` as ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET;
   this script reads them from, in order:
     - CLI flags  --client-id / --client-secret
     - env vars / `.env`  via athena.config.Settings
2. A GRANT CODE: API console -> your Self Client -> "Generate Code" tab. Enter the scopes
   the app was validated with (docs/LIVE_API_VALIDATION.md row 7):

       ZohoCRM.modules.ALL,ZohoCRM.settings.READ

   Pick the longest validity offered (10 minutes; the default is only 3) and generate.
   The code is single-use and DC-specific — generate it on the same account/DC the
   CRM data lives in.

HOW TO RUN
==========
From `backend/`, with client id/secret already in `.env`, within the code's validity:

    uv run python scripts/zoho_oauth.py

It will prompt for the grant code (or pass --code). The exchange hits
https://accounts.zoho.{dc}/oauth/v2/token with grant_type=authorization_code; the DC comes
from --dc, else ZOHO_DC in `.env` (default: com). Self clients need no redirect_uri.

The script only exchanges and prints; it never writes `.env` — paste the printed
ZOHO_REFRESH_TOKEN line yourself.

Official reference: https://www.zoho.com/accounts/protocol/oauth/self-client/authorization-code-flow.html
Verified against the Zoho Accounts docs on 2026-07-22.
"""
from __future__ import annotations

import argparse
import sys

import httpx

# The scope string to enter in the API console's "Generate Code" tab. Scopes are baked into
# the grant code there — the exchange itself takes no scope parameter.
CONSOLE_SCOPES = "ZohoCRM.modules.ALL,ZohoCRM.settings.READ"

# Zoho error code -> what to actually do about it. The token endpoint returns these as
# {"error": "<code>"} with no description — and often with HTTP 200 (see exchange_code).
ERROR_HINTS = {
    "invalid_code": "the grant code expired (3-10 min validity), was already used (single-use), "
                    "or was generated on a different DC than this exchange targets. Generate a "
                    "fresh code and re-run promptly.",
    "invalid_client": "client id unknown on this DC - check ZOHO_CLIENT_ID and that --dc/ZOHO_DC "
                      "matches the DC the self client was created on.",
    "invalid_client_secret": "client secret does not match - re-copy ZOHO_CLIENT_SECRET from the "
                             "API console (Self Client -> Client Secret).",
}


def resolve_credentials(args) -> tuple[str, str, str]:
    """Flags first, then athena.config.Settings (env vars / `.env`). Returns
    (client_id, client_secret, dc)."""
    client_id, client_secret, dc = args.client_id, args.client_secret, args.dc
    settings_error = ""
    if not (client_id and client_secret and dc):
        try:
            from athena.config import Settings
            s = Settings()
            client_id = client_id or s.zoho_client_id
            client_secret = client_secret or s.zoho_client_secret
            dc = dc or s.zoho_dc
        except Exception as exc:  # pragma: no cover - allow running before the package is importable
            settings_error = f"\n(note: loading athena.config.Settings failed: {exc})"
    if not client_id or not client_secret:
        raise SystemExit(
            "Missing client id/secret. Pass --client-id/--client-secret, set "
            "ZOHO_CLIENT_ID/ZOHO_CLIENT_SECRET in the environment, or put them in .env."
            + settings_error)
    return client_id, client_secret, dc or "com"


def exchange_code(client_id: str, client_secret: str, code: str, dc: str) -> dict:
    """POST the grant code to the DC's token endpoint and return the parsed JSON.
    Raises SystemExit with a readable message on any error — including Zoho's quirk of
    answering HTTP 200 with an {"error": "..."} body (e.g. invalid_code)."""
    url = f"https://accounts.zoho.{dc}/oauth/v2/token"
    try:
        resp = httpx.post(url, data={
            "grant_type": "authorization_code",
            "client_id": client_id,
            "client_secret": client_secret,
            "code": code,
        }, timeout=30.0)
    except httpx.HTTPError as exc:
        raise SystemExit(f"network error calling {url}: {exc}")
    try:
        body = resp.json()
    except ValueError:
        raise SystemExit(f"non-JSON response from {url} ({resp.status_code}): {resp.text[:400]}")
    err = body.get("error") if isinstance(body, dict) else None
    if err or not isinstance(body, dict) or resp.status_code >= 400:
        lines = [f"Zoho token endpoint error (HTTP {resp.status_code}): {err or body}"]
        if err in ERROR_HINTS:
            lines.append(f"  -> {ERROR_HINTS[err]}")
        raise SystemExit("\n".join(lines))
    if not body.get("refresh_token"):
        raise SystemExit(f"response contains no refresh_token: {body}")
    return body


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(
        description="Exchange a Zoho self-client grant code for a refresh token "
                    "(printed, never written to .env).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="See the module docstring (top of this file) for the full setup checklist.")
    p.add_argument("--client-id", default="", help="Self client id (else env/.env)")
    p.add_argument("--client-secret", default="", help="Self client secret (else env/.env)")
    p.add_argument("--dc", default="",
                   help="Zoho data centre TLD: com, eu, in, com.au, jp, ca "
                        "(else ZOHO_DC in env/.env; default: com)")
    p.add_argument("--code", default="",
                   help="Grant code from the API console (else you'll be prompted)")
    args = p.parse_args(argv)

    client_id, client_secret, dc = resolve_credentials(args)
    print(f"Using client id {client_id[:12]}... against accounts.zoho.{dc}")

    code = args.code or input(
        f"\nPaste the grant code (API console -> Self Client -> Generate Code, scopes:\n"
        f"  {CONSOLE_SCOPES}\n): ").strip()
    if not code:
        raise SystemExit("No grant code given.")

    print("\nExchanging the grant code for tokens ...")
    tokens = exchange_code(client_id, client_secret, code, dc)

    print("\n=== Zoho tokens ===")
    print(f"refresh_token: {tokens['refresh_token']}   (does not rotate or expire)")
    print(f"access_token:  {tokens.get('access_token', '')}   "
          f"(expires in {tokens.get('expires_in', '?')}s; the adapter mints its own)")
    print(f"api_domain:    {tokens.get('api_domain', '')}")

    print("\n=== Paste into .env ===")
    print(f"ZOHO_REFRESH_TOKEN={tokens['refresh_token']}")
    print("\n(Keep ZOHO_CLIENT_ID/ZOHO_CLIENT_SECRET as they are - the adapter refreshes "
          "with all three.)")
    print("Set SOURCE_MODE=live or ZOHO_SOURCE_MODE=live to actually use them.")

    print("\nDone.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
