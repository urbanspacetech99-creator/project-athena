# zoho oauth helper script — implementation plan

## Goal
Add `scripts/zoho_oauth.py`: a one-command helper that exchanges a Zoho self-client grant code for a refresh token, in the style of `scripts/canva_oauth.py`.

## State
- Design: approved in conversation 2026-07-22 (no design doc)
- Base: f23e09d (main)
- M1: done
- RF1: done

## Decomposition
- **Credential resolution** — client id/secret from CLI flags, else `athena.config.Settings` (`.env`), mirroring `resolve_credentials` in the Canva script. DC from `--dc` else `ZOHO_DC` else `com`.
- **Exchange** — prompt for the grant code (or `--code` flag), POST `grant_type=authorization_code` to `https://accounts.zoho.{dc}/oauth/v2/token`, print `refresh_token`, `access_token`, `api_domain`, `expires_in`. No PKCE, no browser, no local server — the API console generates the code.
- **Output** — print the tokens plus a closing instruction to paste the refresh token into `.env` as `ZOHO_REFRESH_TOKEN`. **No file mutation of any kind** (user decision 2026-07-22): the script never touches `.env` — print-only, like `meta_credentials.py`. No DB persistence either: the Zoho adapter reads the refresh token from `Settings` on every fetch, and Zoho refresh tokens don't rotate.
- **Self-documentation** — module docstring covering when/why to use it, the scope string to grant (`ZohoCRM.modules.ALL,ZohoCRM.settings.READ`), the 10-minute grant-code window, and DC gotchas — same register as the Canva script's docstring.

## Behaviours to verify
- Given id/secret in `.env` and a valid grant code, the refresh token is printed along with the instruction to paste it into `.env`. The script writes no files.
- Given a bogus/expired code, the script exits non-zero surfacing Zoho's error — **including Zoho's quirk of returning HTTP 200 with `{"error": "invalid_code"}` in the body**; a status check alone is not enough.
- Given `--dc eu` (or `ZOHO_DC=eu`), the POST targets `accounts.zoho.eu`.
- Given no resolvable id/secret, the script exits with a message naming the three sources (flags, env vars, `.env`).

## Milestones
1. Exchange path: script with docstring, arg parsing, credential/DC resolution, token POST with 200-with-error-body detection, printed results with the paste-into-`.env` instruction.
   Done when: `uv run python scripts/zoho_oauth.py --help` works, and a run with a deliberately bogus code exits non-zero printing Zoho's `invalid_code` error (proves live endpoint wiring and the error path).

## Risk / open questions
- Zoho token endpoint's 200-with-error-body quirk is the main correctness trap (M1 behaviour above).
- ~~`redirect_uri` question~~ resolved: Zoho's self-client docs (checked 2026-07-22) list only `client_id`, `client_secret`, `grant_type`, `code` — no redirect_uri. Grant code default validity is **3 minutes** (configurable to 10 at generation); docstring tells the user to pick 10.
- Final end-to-end proof (real grant code → real refresh token) happens when the user runs it against the self client they're creating now — the grant code's 10-minute window means I can't stage that verification myself.

No test scaffolding: repo convention — credential helper scripts (`canva_oauth.py`, `meta_credentials.py`) are untested, verified by live use; the named manual routines above are the suite-equivalent.

## Review notes — feature review (2026-07-22)

Verdict: **ready** — 0 Critical, 0 Important, 2 Minor. Reviewer independently reproduced the live `invalid_code`-with-HTTP-200 verification, confirmed the `--dc eu` and missing-credentials behaviours, verified print-only by grep + clean worktree after runs, and ran the full suite (207 passed).

- RF1.1 (Minor) `zoho_oauth.py:118` — `body.get("refresh_token")` lacks the `isinstance(body, dict)` guard the error check has; a non-dict 200 JSON would traceback instead of a readable SystemExit. Fix: fold non-dict into the error branch. recheck: bogus-code run still exits 1 with the readable message. Status: fixed in RF1.
- RF1.2 (Minor) `zoho_oauth.py:85` — `except Exception: pass` around `Settings()` masks a malformed `.env` as "Missing client id/secret". Fix: capture the load error and append it to the message. recheck: missing-credentials path still names the three sources. Status: fixed in RF1.
