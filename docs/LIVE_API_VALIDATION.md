# Live API Validation Checklist

> **Standing reminder — every plan ends by pointing here.**
>
> The pipeline is built and tested in **`fixture` mode**. Fixtures are shaped to match the **authoritative online API documentation** (the source of truth used during development, since live keys are provisioned late). Each `fetch_live` path is **implemented but NOT yet validated against a real endpoint.**
>
> **Before production**, every integration below must be validated live: obtain credentials, set the source to `live` (`SOURCE_MODE=live` or the per-source override), run the ingestion/AI path against the real API, and confirm the response shape still matches the fixture the normalizer/parser expects (the parity tests encode that contract). Update the **Status** column as each is validated.

## How to validate a source
1. Provision the credentials (see each row) and put them in `.env` (git-ignored).
2. Flip that source to live: e.g. `META_SOURCE_MODE=live` (or global `SOURCE_MODE=live`).
3. Trigger it: `POST /ingest/{source}` (data sources) or exercise the feature endpoint (AI).
4. Compare the live response to the committed fixture; if the live shape drifted from the docs, update the fixture + parity reference and re-run the parity test.
5. Watch the structured logs for the live call (`source`, `endpoint`, `status`, `duration_ms`).

## Integrations

| # | API | Version (as-built) | Used by | Credentials / env | Validate | Status |
|---|-----|--------------------|---------|-------------------|----------|--------|
| 1 | **Anthropic Claude Sonnet** (text) | Messages API via langchain-anthropic; model claude-sonnet-5; structured output; thinking disabled | Plan 3+ AI (comment insights, analysts, title suggester, generator captions) | `CLAUDE_API_KEY`, `CLAUDE_MODEL`, `LLM_MODE=live` | Confirm model id valid, structured output binds to the Pydantic schema, latency/costs, rate limits | ✅ **validated 2026-07-14** — live `structured()` returned a valid `TitleSuggestions` (5 titles + prefill) via `with_structured_output`; end-to-end `research_internet_trends` with live Claude + a seeded Postgres testcontainer returned 5 context-aware titles. Model id `claude-sonnet-5` valid; thinking disabled; no temperature. |
| 2 | **Google Gemini** image ("NanoBanana" = Gemini 2.5 Flash Image) | Model `gemini-2.5-flash-image`; `POST /v1beta/models/{model}:generateContent`; header `x-goog-api-key`; request `generationConfig.responseModalities:["IMAGE"]` + `imageConfig.aspectRatio`; response `candidates[0].content.parts[].inlineData{mimeType,data}` | Plan 5 Post Generator images (`athena.ai.images`) | `GEMINI_API_KEY`, `GEMINI_IMAGE_MODEL`, `IMAGE_MODE=live` | Confirm the model id + image-part response shape; **R7:** current docs also show a newer `/v1beta/interactions` endpoint (`steps[].content[].data`) — confirm which endpoint is GA when the key is provisioned, and if it changed, update `parse_gemini_image` + `src/athena/ai/fixtures/gemini_image.json`. Also verify content-safety behaviour: safety-filtered prompts return 200 OK with empty `candidates` (parser raises `ValueError`) | ✅ **validated 2026-07-14** — live `generate()` returned a valid ~1.8 MB PNG (`candidates[0].content.parts[].inlineData`, mime `image/png`). The `AQ.`-format `GEMINI_API_KEY` authenticated fine. **R7 resolved:** the `:generateContent` endpoint is GA and matches `parse_gemini_image` + `gemini_image.json`; the `/v1beta/interactions` variant was not needed. Safety-filter path (`content: null`) hardened + unit-tested. |
| 3 | **Meta Graph — own FB/IG** | v25.0 | Plan 2 `ingest_meta_posts`; Plan 3 KPIs/engagement | `META_APP_ID/SECRET`, `META_PAGE_ID`, `META_PAGE_TOKEN`, `META_IG_USER_ID` | Page + IG Business linked; long-lived token; verify `reactions/comments.summary(true)`, IG insights `views` (not deprecated `impressions`), comment id format | ✅ **validated 2026-07-22, re-confirmed 2026-08-07** — `POST /ingest/meta` returns 50 live own-post rows. **Own-post *comments* are not fetched live:** `ingest_meta_posts` passes `{"data": []}` outside fixture mode, so `post_comments` stays empty in live mode by design (the Social tab's "Post comments" card reads 0). |
| 4 | **Meta Graph — competitor (PPCA)** | v25.0 | Plan 2 `ingest_competitor_posts` | Same + `competitor_live_access_enabled=true` | **Likely NOT grantable (R1)** — PPCA is discretionary; may stay fixtures-only. Confirm feasibility before relying on it | ◐ **partial, 2026-08-07 — Instagram live, Facebook gated.** `POST /ingest/competitor` returns 50 live IG rows (25 per competitor, via `business_discovery`); both Facebook competitors are skipped by the hoisted `COMPETITOR_LIVE_ACCESS_ENABLED` gate, which is the intended behaviour until PPCA is granted. Competitor *comment* text stays fixture-only on both platforms. |
| 5 | **Google Business Profile — reviews** | v4 | Plan 2 `ingest_google_reviews` | `GOOGLE_OAUTH_CLIENT_ID/SECRET`, `GOOGLE_REVIEWS_REFRESH_TOKEN` (scope `business.manage`), `GBP_ACCOUNT_ID`, `GBP_LOCATION_ID` | Access-gated (allowlist app); verified location; verify `starRating` enum strings, `totalReviewCount`, anonymous reviewer/no-reply cases | 🚫 **blocked 2026-08-07 — GBP API quota is 0.** The OAuth grant itself is fine (refreshes, scope `business.manage`). Every Business Profile call answers 429 `RESOURCE_EXHAUSTED` with `quota_limit_value: "0"` on project 26063645919 — that project was never granted GBP API access, so `accounts.list`/`locations.list` cannot run and **`GBP_LOCATION_ID` cannot be discovered**. `GBP_ACCOUNT_ID` also held the OAuth *client id* (not a numeric account id) until it was cleared. Pinned `GOOGLE_REVIEWS_SOURCE_MODE=fixture`. See "Unblocking" §5. |
| 6 | **Google Ads — Keyword Planner** | v24 | Plan 2 `ingest_keyword_volumes` | `GOOGLE_OAUTH_CLIENT_ID/SECRET`, `GOOGLE_ADS_REFRESH_TOKEN` (scope `adwords`), `GADS_DEVELOPER_TOKEN`, `GADS_LOGIN_CUSTOMER_ID`, `GADS_CUSTOMER_ID` | Developer token approval (slow); verify int64-as-string fields, monthly→weekly derivation, `keywordPlanNetwork`/geo/language constants | 🚫 **blocked 2026-08-07 — no `adwords` grant.** The only Google refresh token on file carries `business.manage` only, so it authenticates #5 and not this. Developer token, login-customer-id and customer-id are all set; the consent is the single missing piece and needs a browser sign-in as the Ads-manager account. Pinned `GOOGLE_ADS_SOURCE_MODE=fixture`. See "Unblocking" §6. |
| 7 | **Zoho CRM — chats** | v6 | Plan 2 `ingest_zoho_chats` | `ZOHO_CLIENT_ID/SECRET`, `ZOHO_REFRESH_TOKEN`, `ZOHO_DC`, `ZOHO_MODULE`, `ZOHO_TRANSCRIPT_FIELD` | Confirm the real module + transcript field API names (R5) via `/settings/modules` + `/settings/fields`; use `api_domain` from the token response; verify record shape | ✅ **VALIDATED end-to-end 2026-07-10** — auth (refresh→access token, `api_domain=https://www.zohoapis.com`), module + field **discovered via `/settings/*` (scope `ZohoCRM.modules.ALL,ZohoCRM.settings.READ`)**. **R5 RESOLVED: module = `Call_Logs` (custom), transcript field = `Transcript_Text`** (the `Transcript` field is empty; `Call_Summary` also present). Live fetch returned 19 records; `normalize` yields 19 rows (tz-aware `Created_Time`, DB-row shape exact). Config defaults + fixture + parity ref updated to this shape. **Live-caught bug FIXED:** empty records return the field as JSON `null`; `normalize` now coerces `None → ""` (was `rec.get(field, "")`, which passed `None` through). `ZOHO_MODULE`/`ZOHO_TRANSCRIPT_FIELD` set in `.env`. Pagination: `more_records` seen `false` at 19 rows — the cross-cutting first-page-only note still applies beyond 200. **⚠️ REGRESSED 2026-08-07: `Call_Logs` no longer exists in the org these credentials reach** — `/settings/modules` lists no such module and the record call answers 400 `INVALID_MODULE`; the stock `Calls` module is present but empty (204). Auth and scopes are still good (`ZohoCRM.modules.ALL ZohoCRM.settings.READ`). The 20 `zoho_chats` rows in the live DB date from the 2026-07-10 run. **This hid for a while because the adapter swallowed it:** Zoho's `{"code","message","status":"error"}` body has no top-level `error` key, so a 400 normalized to zero rows and the ingest reported success — `fetch_live` now raises on `status == "error"` (and treats 204 as no records). See "Unblocking" §7. |
| 8 | **Canva Connect** | `POST /rest/v1/asset-uploads` (async job → `job.asset.id`) then `POST /rest/v1/designs` (→ `design.urls.edit_url`) | Plan 5 image edit handoff (`athena.integrations.canva`) | `CANVA_CLIENT_ID/SECRET`, `CANVA_ACCESS_TOKEN` (OAuth), `CANVA_MODE=live` | **R8:** asset upload is an **async job** — current client reads only the immediate response and does NOT poll `GET /asset-uploads/{id}` for completion; add polling before live use. Verify the design-create `asset_id` linkage, edit-URL response shape, and OAuth scopes | ✅ **VALIDATED end-to-end 2026-07-10** — completed the PKCE authorization-code flow (loopback `http://127.0.0.1:8912/callback`), minted access + refresh tokens (scopes `asset:read asset:write design:content:write design:meta:read`, in `.env`), and confirmed the real upload→poll→create-design flow returns a working `edit_url` through the fixed `CanvaConnectClient`. **Three live-caught bugs FIXED:** (1) `Asset-Upload-Metadata.name_base64` must be base64 of the **name string** (was base64 of a JSON object); (2) upload is **async** — now polls `GET /asset-uploads/{id}` until `success` (needs `asset:read`); (3) create-design body must be `{"type":"type_and_asset","design_type":{"type":"custom",1080x1080},"asset_id","title"}` (the `instagram_post` preset was invalid). **Remaining follow-up:** access tokens expire in ~4h and Canva uses **rotating** refresh tokens — the client still uses a static `CANVA_ACCESS_TOKEN`; add a refresh flow with token persistence (`CANVA_REFRESH_TOKEN` field is now declared) before unattended long-run use. |
| 9 | **Google Places API (New) — competitor reviews** | v1 (`places.googleapis.com/v1/places/{id}`) | `ingest_competitor_reviews` (competitor Google reviews) | `GOOGLE_PLACES_API_KEY`, `GOOGLE_PLACES_SOURCE_MODE`; per-competitor `place_id` in the `platform="google"` competitor row | API-key auth via `X-Goog-Api-Key`; required `X-Goog-FieldMask: id,rating,userRatingCount,reviews`; **reviews capped at 5** (most-relevant); verify `text.text`, `authorAttribution.displayName`, `publishTime`, place `rating`/`userRatingCount`; resolve each competitor's real `place_id` | ✅ **validated end-to-end 2026-08-07 — via the legacy fallback.** Places API **(New)** is closed to this key two ways: `searchText` answers 403 `SERVICE_DISABLED` (API not enabled on project 836771301276) and `GetPlace` answers 403 `API_KEY_SERVICE_BLOCKED` (the key's API restrictions exclude `places.googleapis.com`). The **legacy** Places API *is* enabled on that key, so `fetch_live` retries those two reasons — and only those — against `maps.googleapis.com/maps/api/place/details/json`, reshaping the payload into the (New) shape so `normalize` stays one path. Legacy caps reviews at 5 too. `place_id`s resolved for both rivals (neither has a brand-level listing; each row points at that chain's most-reviewed SG outlet — Extra Space Eunos Link, StorHub Toa Payoh) and seeded in `seed_data.COMPETITORS`. Live run: 10 reviews across both competitors, place ratings 4.9/489 and 4.8/800. See "Unblocking" §9 to move back onto (New). |

## Unblocking the remaining live sources

State as of 2026-08-07. Each block is what a *person with console access* has to do; none of
it can be done from the repo. Re-run `POST /ingest/{source}` afterwards and update the row.

**§5 — Google Business Profile reviews (quota).** The blocker is Google-side approval, not
config. Apply for Business Profile API access for GCP project **26063645919** via the
[GBP API access request form](https://developers.google.com/my-business/content/prereqs),
which asks for the project number and the Business Profile account that owns the listing.
Approval raises the per-minute quota above 0 on `mybusinessaccountmanagement`,
`mybusinessbusinessinformation` and `mybusiness` (v4). Then, in order:

1. `GET https://mybusinessaccountmanagement.googleapis.com/v1/accounts` → put the **numeric**
   id from `accounts[].name` (`accounts/123456789012345`) in `GBP_ACCOUNT_ID`.
2. `GET https://mybusinessbusinessinformation.googleapis.com/v1/accounts/{id}/locations?readMask=name,title`
   → put the id from `locations[].name` (`locations/987654321`) in `GBP_LOCATION_ID`.
3. Set `GOOGLE_REVIEWS_SOURCE_MODE=live`.

There is no way around step 1–2: a GBP location id lives in its own namespace and cannot be
derived from a Places `place_id`, a business name, or anything else the repo can reach.

**§6 — Google Ads Keyword Planner (consent).** Everything but the grant is in place. Sign in
as the account that administers the Ads manager and run:

```
cd backend && uv run python scripts/google_oauth.py --source google_ads
```

Paste the printed token into `GOOGLE_ADS_REFRESH_TOKEN` (the script only prints — it never
writes `.env`), then set `GOOGLE_ADS_SOURCE_MODE=live`. If that same account also owns the
Business Profile, `--source both` gets both scopes in one consent and the one token fills
both variables.

**§7 — Zoho transcripts (missing module).** `ZOHO_MODULE=Call_Logs` does not exist in the org
these credentials reach; `/settings/modules` lists only stock modules plus subforms, and
`Calls` is empty. Either point the credentials back at the org that has the custom module, or
recreate it, or pick a module that does hold the transcripts and set `ZOHO_MODULE` +
`ZOHO_TRANSCRIPT_FIELD` to its API names. List the candidates with:

```
GET {api_domain}/crm/v6/settings/modules
GET {api_domain}/crm/v6/settings/fields?module={module}
```

Record reads **require** the `fields` parameter — omitting it returns 400
`REQUIRED_PARAM_MISSING`, not an empty list.

**§9 — Places API (New) (optional).** Competitor reviews already work through the legacy
fallback, so this is only to get back onto the current API. Two gates, both on the key's
project **836771301276**: enable **Places API (New)** in the console, *and* widen the API-key
restriction to include `places.googleapis.com`. The adapter needs no change — it prefers
(New) and only falls back on those two denials. One-off cost: legacy reviews carry no
resource id, so the same reviews re-insert once under (New)'s `name`-based ids.

## Cross-cutting reminders
- **Mixed-mode routing (2026-07-22):** with global `SOURCE_MODE=live`, a source whose override pins it to `fixture` is **routed**, not skipped: its ingestion writes the fixture DB (`FIXTURE_DATABASE_URL`) and the API serves its fixture rows alongside the live sources' live rows — each DB holds only its own kind. `skipped: true` from `POST /ingest/{source}` survives only in the degenerate single-DB config (live mode, no `FIXTURE_DATABASE_URL`), where fixture rows would otherwise land in the live DB.
- **Pagination:** current `fetch_live` implementations read only the first page (`paging.next` / `nextPageToken` ignored). Add pagination before large-scale live ingestion (noted in Plan 2 final review as FUTURE).
- **Canva token lifecycle (#8):** async upload-job polling is now implemented and validated. Remaining gap — access tokens expire in ~4h and refresh tokens **rotate** (each refresh returns a new one, invalidating the old), so the static-`CANVA_ACCESS_TOKEN` client needs a refresh flow *with persistence* of the rotated `CANVA_REFRESH_TOKEN` before unattended long-running use.
- **LangGraph fan-out threads:** LangGraph's sync `.invoke()` runs a superstep's nodes on real threads (verified on 1.2.8). The Plan-5 aggregator (feature 10) therefore opens a **fresh SQLAlchemy Session per analyst node** (Sessions are not thread-safe); preserve this when adding graphs or nodes.
- **Google OAuth is one client, two grants (2026-08-03):** reviews (#5) and Keyword Planner (#6) share `GOOGLE_OAUTH_CLIENT_ID/SECRET` but hold their own refresh token — `GOOGLE_REVIEWS_REFRESH_TOKEN` / `GOOGLE_ADS_REFRESH_TOKEN`, with no shared fallback. They are separate because the Business Profile owner and the Ads manager account are usually different Google accounts, which no single consent screen can span. Mint each with `uv run python scripts/google_oauth.py --source google_reviews|google_ads`; where one account owns both, `--source both` gets both scopes in one consent and that single token goes in both variables. A grant carrying the wrong scope fails at token-refresh time naming the variable to fix, rather than as a 403 from the API.
- **No scraping, authorized APIs only** (compliance §2) — do not work around a denied access path (e.g. competitor PPCA) with scraping.
- **Do not train/fine-tune on retrieved data** (compliance §2.3).
