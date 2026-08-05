#!/usr/bin/env python
"""Derive META_PAGE_ID / META_PAGE_TOKEN / META_IG_USER_ID from a Meta app id + secret + token.

WHEN TO USE THIS
================
The Meta adapters (`backend/src/athena/adapters/meta.py`) read three settings and nothing else:

    META_PAGE_ID       the Facebook Page whose /posts we ingest
    META_PAGE_TOKEN    a PAGE access token (also used for the IG calls)
    META_IG_USER_ID    the IG Business account linked to that Page

The Meta developer dashboard hands you an APP ID, an APP SECRET and a USER access token
instead. None of those three go in `.env` - there is no Meta refresh flow in this app
(unlike Canva, see backend/scripts/canva_oauth.py), so `meta_page_token` must be a token that does
not expire. This script does the exchange and prints the three values.

WHAT YOU NEED FIRST
===================
1. APP ID + APP SECRET (developers.facebook.com -> your app -> App settings -> Basic).
2. A USER access token for an account with an admin role on the Page, generated with these
   scopes (Graph API Explorer -> select your app -> "Generate Access Token"):

       pages_show_list  pages_read_engagement  pages_read_user_content
       instagram_basic  instagram_manage_insights

   A short-lived (1 hour) token is fine - this script exchanges it for a long-lived one.
   An APP access token ("{app-id}|{app-secret}") will NOT work: it cannot read Page posts
   or IG insights. The script tells you if you pass one.

HOW TO RUN
==========
From `backend/`:

    uv run python scripts/meta_credentials.py \
        --app-id 1234567890 \
        --app-secret abcdef0123456789abcdef0123456789 \
        --access-token EAAG...

Values also fall back to the env vars META_APP_ID / META_APP_SECRET / META_ACCESS_TOKEN.
Add --verify to run the real MetaOwnPostsAdapter against the derived credentials before you
trust them; add --page-id to pick a Page when the account administers several.

WHAT IT DOES
============
1. GET /debug_token                 validate the token: is it valid, is it OURS (app id
                                    match), what type is it (USER/PAGE/APP), which scopes.
2. GET /oauth/access_token          exchange the user token for a long-lived (~60 day) one.
   (grant_type=fb_exchange_token)   This is the ONLY step that needs the app id + secret.
3. GET /me/accounts                 the Pages you admin, each with its own Page token. A Page
                                    token minted from a LONG-LIVED user token never expires,
                                    which is why step 2 must come first.
4. GET /{page-id}                   ?fields=instagram_business_account -> META_IG_USER_ID.
                                    Empty unless the IG account is a Business/Creator account
                                    linked to that Page.
5. GET /debug_token (again)         confirm the Page token really has no expiry.

The script only reads; it prints an .env block for you to paste. It never writes `.env`.

WHAT IT CANNOT GIVE YOU
=======================
MetaCompetitorAdapter.fetch_live (competitor Facebook Pages) needs Page Public Content
Access, which is an app-review + business-verification feature, not a token you can mint.
It stays gated behind `competitor_live_access_enabled` regardless of what this prints.
MetaIGCompetitorAdapter (Business Discovery) works with just these credentials.

Official reference: https://developers.facebook.com/docs/facebook-login/guides/access-tokens/
Verified against Graph API v25.0 docs on 2026-07-17.
"""
from __future__ import annotations

import argparse
import os
import sys

import httpx

# Imported so this helper and the runtime adapter can never drift onto different API
# versions (the field lists in meta.py are pinned to v25.0).
try:
    from athena.adapters.meta import GRAPH
except Exception:  # pragma: no cover - allow running before the package is importable
    GRAPH = "https://graph.facebook.com/v25.0"

# Scope -> the call in backend/src/athena/adapters/meta.py that breaks without it.
REQUIRED_SCOPES = {
    "pages_show_list": "GET /me/accounts (this script; how the Page token is minted)",
    "pages_read_engagement": "GET /{page}/posts + reactions.summary - MetaOwnPostsAdapter.fetch_live",
    "pages_read_user_content": "GET /{post}/comments - MetaOwnPostsAdapter.fetch_comments_live",
    "instagram_basic": "GET /{ig}/media, business_discovery - MetaIGCompetitorAdapter.fetch_live",
    "instagram_manage_insights": "GET /{ig-media}/insights (reach/views/total_interactions)",
}

# Graph error codes worth translating; the raw message is usually too terse to act on.
ERROR_HINTS = {
    190: "the access token is invalid, expired, or was revoked - generate a fresh one in the "
         "Graph API Explorer and re-run.",
    102: "session expired - generate a fresh token.",
    200: "the token is missing a permission for this call. Re-generate it with the scopes "
         "listed in this script's docstring.",
    10: "this call needs a feature your app lacks (e.g. Page Public Content Access), which "
        "requires App Review + business verification - not something a token can grant.",
    100: "bad parameter or field. For instagram_business_account this usually means the IG "
         "account is not a Business/Creator account linked to the Page.",
    4: "application request limit reached - wait and retry.",
    17: "user request limit reached - wait and retry.",
}


def _format_error(err: dict, url: str) -> str:
    code = err.get("code")
    lines = [
        f"Graph API error on {url.split('?')[0]}",
        f"  message:  {err.get('message')}",
        f"  type:     {err.get('type')}  code: {code}  subcode: {err.get('error_subcode')}",
    ]
    if err.get("error_user_msg"):
        lines.append(f"  user msg: {err['error_user_msg']}")
    if isinstance(code, int) and code in ERROR_HINTS:
        lines.append(f"  -> {ERROR_HINTS[code]}")
    if err.get("fbtrace_id"):
        lines.append(f"  fbtrace_id: {err['fbtrace_id']} (quote this to Meta support)")
    return "\n".join(lines)


def graph_get(path: str, params: dict | None = None) -> dict:
    """GET the Graph API and return parsed JSON. Raises SystemExit with a readable message
    on an {"error": {...}} envelope - Graph returns those with a 4xx AND sometimes a 200."""
    url = path if path.startswith("http") else f"{GRAPH}{path}"
    try:
        resp = httpx.get(url, params=params, timeout=30.0)
    except httpx.HTTPError as exc:
        raise SystemExit(f"network error calling {url}: {exc}")
    try:
        body = resp.json()
    except ValueError:
        raise SystemExit(f"non-JSON response from {url} ({resp.status_code}): {resp.text[:400]}")
    if isinstance(body, dict) and "error" in body:
        raise SystemExit(_format_error(body["error"], url))
    return body


def _fmt_expiry(ts: int | None) -> str:
    """Graph reports expiry as a unix ts; 0 (or missing) means 'never expires'."""
    if not ts:
        return "never"
    from datetime import datetime, timezone
    return datetime.fromtimestamp(ts, timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def app_token(app_id: str, app_secret: str) -> str:
    return f"{app_id}|{app_secret}"


def inspect_token(app_id: str, app_secret: str, token: str) -> dict:
    body = graph_get("/debug_token", {"input_token": token,
                                      "access_token": app_token(app_id, app_secret)})
    return body.get("data", {}) or {}


def check_token(data: dict, app_id: str) -> None:
    """Fail fast on the three ways the supplied token is simply the wrong thing."""
    if not data.get("is_valid"):
        raise SystemExit(
            f"Token is not valid: {data.get('error', {}).get('message', 'no reason given')}\n"
            "Generate a fresh User access token in the Graph API Explorer and re-run.")
    if str(data.get("app_id")) != str(app_id):
        raise SystemExit(
            f"Token belongs to app {data.get('app_id')}, not {app_id}. The token, app id and "
            "app secret must all come from the SAME app.")
    ttype = (data.get("type") or "").upper()
    if ttype == "APP":
        raise SystemExit(
            "This is an APP access token ('{app-id}|{app-secret}'). It cannot read Page posts "
            "or IG insights.\nGenerate a USER access token instead: Graph API Explorer -> pick "
            "your app -> User token -> add the scopes in this script's docstring.")


def report_scopes(data: dict) -> None:
    granted = set(data.get("scopes") or [])
    print("\nScopes on this token:")
    for scope, why in REQUIRED_SCOPES.items():
        mark = "ok     " if scope in granted else "MISSING"
        print(f"  [{mark}] {scope:<28} {why}")
    missing = [s for s in REQUIRED_SCOPES if s not in granted]
    if missing:
        print("\n  Missing scopes will surface later as code-200 errors. Re-generate the token "
              "with:\n    " + " ".join(REQUIRED_SCOPES))
    extra = granted - set(REQUIRED_SCOPES)
    if extra:
        print(f"\n  (also granted, unused by this app: {', '.join(sorted(extra))})")


def exchange_for_long_lived(app_id: str, app_secret: str, token: str) -> str:
    """Short-lived user token (1h) -> long-lived user token (~60d). Passing an already
    long-lived token is harmless: Graph returns a long-lived one either way (it does not
    extend the original 60 days)."""
    body = graph_get("/oauth/access_token", {
        "grant_type": "fb_exchange_token",
        "client_id": app_id,
        "client_secret": app_secret,
        "fb_exchange_token": token,
    })
    if not body.get("access_token"):
        raise SystemExit(f"token exchange returned no access_token: {body}")
    return body["access_token"]


def list_pages(user_token: str) -> list[dict]:
    """Every Page the user administers, each with its own Page access token."""
    pages: list[dict] = []
    body = graph_get("/me/accounts", {"fields": "id,name,access_token,tasks",
                                      "limit": 100, "access_token": user_token})
    while True:
        pages.extend(body.get("data", []))
        nxt = (body.get("paging") or {}).get("next")
        if not nxt or len(pages) >= 500:
            break
        body = graph_get(nxt)
    return pages


def choose_page(pages: list[dict], wanted: str) -> dict:
    if not pages:
        raise SystemExit(
            "No Pages returned by /me/accounts. Either the token lacks pages_show_list, or "
            "this account has no admin role on any Page.")
    if wanted:
        for p in pages:
            if p["id"] == wanted or p.get("name") == wanted:
                return p
        listing = "\n".join(f"    {p['id']}  {p.get('name')}" for p in pages)
        raise SystemExit(f"No Page matching {wanted!r}. Available:\n{listing}")
    if len(pages) == 1:
        return pages[0]
    listing = "\n".join(f"    {p['id']}  {p.get('name')}" for p in pages)
    raise SystemExit(f"This account administers {len(pages)} Pages - pass --page-id to pick "
                     f"one:\n{listing}")


def find_ig_user_id(page_id: str, page_token: str) -> tuple[str, str]:
    body = graph_get(f"/{page_id}", {"fields": "instagram_business_account{id,username}",
                                     "access_token": page_token})
    ig = body.get("instagram_business_account") or {}
    return ig.get("id", ""), ig.get("username", "")


def verify_with_adapter(page_id: str, page_token: str, ig_id: str) -> None:
    """Exercise the REAL adapter against the derived credentials, rather than re-implementing
    its calls here (which would drift from meta.py's field lists)."""
    from athena.adapters.meta import MetaOwnPostsAdapter
    from athena.config import Settings

    settings = Settings(meta_page_id=page_id, meta_page_token=page_token, meta_ig_user_id=ig_id)
    adapter = MetaOwnPostsAdapter("live", settings)
    print("\n5) --verify: running MetaOwnPostsAdapter.fetch_live() ...")
    try:
        raw = adapter.fetch_live()
        rows = adapter.normalize(raw)
    except RuntimeError as exc:  # raise_on_error_envelope
        raise SystemExit(f"   adapter call FAILED: {exc}")
    fb = sum(1 for r in rows if r["platform"] == "facebook")
    ig = sum(1 for r in rows if r["platform"] == "instagram")
    print(f"   ok: {len(rows)} normalized rows ({fb} facebook, {ig} instagram)")
    if not rows:
        print("   (zero rows is not an auth failure - the Page/IG account may just have no posts)")


def resolve_credentials(args) -> tuple[str, str, str]:
    app_id = args.app_id or os.environ.get("META_APP_ID", "")
    app_secret = args.app_secret or os.environ.get("META_APP_SECRET", "")
    token = args.access_token or os.environ.get("META_ACCESS_TOKEN", "")
    missing = [name for name, val in
               (("--app-id", app_id), ("--app-secret", app_secret), ("--access-token", token))
               if not val]
    if missing:
        raise SystemExit(
            f"Missing {', '.join(missing)}. Pass them as flags, or set META_APP_ID / "
            "META_APP_SECRET / META_ACCESS_TOKEN in the environment.\n"
            "(These three are NOT read from .env - the app itself never uses them; see "
            "backend/src/athena/config.py.)")
    return app_id, app_secret, token


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(
        description="Derive META_PAGE_ID / META_PAGE_TOKEN / META_IG_USER_ID from a Meta "
                    "app id + app secret + user access token.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="See the module docstring (top of this file) for the full setup checklist.")
    p.add_argument("--app-id", default="", help="Meta app id (else $META_APP_ID)")
    p.add_argument("--app-secret", default="", help="Meta app secret (else $META_APP_SECRET)")
    p.add_argument("--access-token", default="",
                   help="User access token, short- or long-lived (else $META_ACCESS_TOKEN)")
    p.add_argument("--page-id", default="",
                   help="Page id (or name) to use when the account administers several")
    p.add_argument("--verify", action="store_true",
                   help="After deriving, run MetaOwnPostsAdapter.fetch_live() against the "
                        "real Graph API to prove the credentials work")
    args = p.parse_args(argv)

    app_id, app_secret, token = resolve_credentials(args)

    print("1) Inspecting the supplied token (/debug_token) ...")
    data = inspect_token(app_id, app_secret, token)
    check_token(data, app_id)
    ttype = (data.get("type") or "").upper()
    print(f"   valid, type={ttype}, app={data.get('application')}, "
          f"expires={_fmt_expiry(data.get('expires_at'))}")
    report_scopes(data)

    if ttype == "PAGE":
        # Already a Page token: /me/accounts is a user-token call, and Graph has no
        # short->long exchange for Page tokens (longevity is inherited from the user token
        # it was minted from), so take it as-is.
        page_id = data.get("profile_id") or args.page_id
        if not page_id:
            raise SystemExit("This is a PAGE token but /debug_token returned no profile_id; "
                             "pass --page-id explicitly.")
        page_token, page_name = token, "(page token supplied directly)"
        print(f"\n2-3) Supplied token is already a PAGE token for page {page_id}; "
              "skipping the user-token exchange.")
    else:
        print("\n2) Exchanging for a long-lived user token (~60 days) ...")
        long_lived = exchange_for_long_lived(app_id, app_secret, token)
        ll = inspect_token(app_id, app_secret, long_lived)
        print(f"   ok, expires={_fmt_expiry(ll.get('expires_at'))}")

        print("\n3) Listing Pages you administer (/me/accounts) ...")
        pages = list_pages(long_lived)
        for pg in pages:
            print(f"   {pg['id']}  {pg.get('name')}")
        page = choose_page(pages, args.page_id)
        page_id, page_token, page_name = page["id"], page["access_token"], page.get("name", "")
        print(f"   -> using: {page_id} ({page_name})")

    print("\n4) Looking up the linked IG Business account ...")
    ig_id, ig_username = find_ig_user_id(page_id, page_token)
    if ig_id:
        print(f"   ok: {ig_id} (@{ig_username})")
    else:
        print("   NONE linked. The IG half of MetaOwnPostsAdapter.fetch_live will fail.\n"
              "   Fix: the IG account must be a Business/Creator account, connected to this "
              "Page (Page settings -> Linked accounts -> Instagram).")

    page_check = inspect_token(app_id, app_secret, page_token)
    expiry = _fmt_expiry(page_check.get("expires_at"))
    print(f"\n   Page token expiry: {expiry}")
    if expiry != "never":
        print("   WARNING: this Page token EXPIRES. The app has no Meta refresh flow, so live "
              "mode will break then.\n   Cause: it was minted from a short-lived user token. "
              "Re-run this script and let step 2 do the exchange.")

    print("\n=== Paste into .env ===")
    print(f"META_PAGE_ID={page_id}")
    print(f"META_PAGE_TOKEN={page_token}")
    print(f"META_IG_USER_ID={ig_id}")
    print("\n(Do NOT add META_APP_ID/META_APP_SECRET - nothing reads them at runtime.)")
    print("Set SOURCE_MODE=live or META_SOURCE_MODE=live to actually use them.")

    if args.verify:
        verify_with_adapter(page_id, page_token, ig_id)

    print("\nDone.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
