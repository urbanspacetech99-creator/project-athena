# Design: per-source DB routing (live alongside fixture data)

Date: 2026-07-22
Status: landed 2026-07-22 (commits 574cb95, 3ac26dc, 5d3fa36, c59091c, RF 04ce5b6); plan: `2026-07-22-source-routing-plan.md`

## Objective

In global live mode, serve each data source from the database its *effective per-source
mode* selects, so the dashboard shows live data (e.g. Meta posts) alongside fixture data
(e.g. Google reviews) in the same view — while the live DB never contains a fixture row
and the fixture DB never contains a live row.

## Background

Two physical DBs exist (`DATABASE_URL` live, `FIXTURE_DATABASE_URL` fixture), but the
whole app binds to exactly one per process via `Settings.active_database_url()`. Since
457ee62, fixture-pinned sources are *skipped* in global live mode to protect live-DB
purity — which leaves their tables empty and data-starves the dashboard and AI features
(the `<UNKNOWN>` review-summary bug was this: an all-empty LLM context).

Key enabling fact: **no feature joins across source tables in SQL** — all cross-source
combination happens in Python — so different tables may safely live on different engines.

## Architecture

### Settings (`src/athena/config.py`)

- `source_mode_for(source)` — unchanged.
- **New** `database_url_for(source) -> str`: effective mode `fixture` →
  `fixture_database_url` (falling back to `database_url` when unset); `live` →
  `database_url`.
- `active_database_url()` — kept, but now governs only **config/app tables**
  (competitors, tracked_keywords, agents, skills, drafts, generated posts, oauth
  tokens): fixture mode keeps config in the fixture DB, live mode in the live DB,
  exactly as today.
- `ingestion_skipped_for(source)` — **narrowed**, not removed: returns true only in the
  degenerate config *global live mode + fixture-pinned source + no
  `FIXTURE_DATABASE_URL`* (single-DB legacy, where routing has nowhere safe to put
  fixture rows). With a fixture DB configured, nothing is ever skipped.

### RoutedSession (`src/athena/db/base.py`)

A `Session` subclass overriding `get_bind()`:

| Source | Models |
|---|---|
| meta | OwnPost, PostComment, CompetitorPost, CompetitorComment |
| google_reviews | GoogleReview |
| google_places | CompetitorReview |
| google_ads | KeywordVolume |
| zoho | ZohoChat |

- Resolution: model/table → source → `database_url_for(source)` → engine.
- Anything not in the map (config/app tables, raw SQL) → default bind =
  `active_database_url()` engine.
- One engine per distinct URL, cached at the factory/module level.
- `get_bind` must resolve for **column-only queries**
  (`session.query(func.max(KeywordVolume.window_date))`) and for **insert/upsert
  statements** (`run_ingestion` / `upsert_rows`) — resolve via the mapper when present,
  else inspect the clause's table. **[risky seam]**
- In global fixture mode every source resolves to the fixture DB → behavior identical
  to today. `make_session_factory` keeps its signature; `get_session` and all
  routes/features are untouched.

### Ingestion (`src/athena/jobs/ingestion_jobs.py`)

The six `ingestion_skipped_for` guards stay in place but now fire only in the degenerate
single-DB config. Otherwise every job always runs; the routed session lands rows in the
right DB automatically — in live mode `ingest_google_reviews` (etc.) refreshes the
*fixture* DB via idempotent upserts. Live-DB purity is preserved by construction rather
than by skipping.

### Deploy (folds in followup 2026-07-22 "compose FIXTURE_DATABASE_URL unreachable")

Routing makes `FIXTURE_DATABASE_URL` load-bearing in live mode, so
`docker-compose.yml` must override it to the compose `db` service (a second database on
the same server, e.g. `athena_fixture`), mirroring the existing `DATABASE_URL`
override. Bootstrap already provisions any configured fixture DB at startup.

## Data flow (current .env: meta+zoho live; reviews/ads/places pinned fixture)

- live DB: own_posts, competitor_posts (+post/competitor comments when available),
  zoho_chats
- fixture DB: google_reviews, keyword_volumes, competitor_reviews
- One dashboard request reads both transparently; `/config/modes` badges already label
  each card Live/Fixture truthfully.
- `research_social_reviews` composes live posts + fixture reviews; the deterministic
  empty-section guard (c1ab5c4) remains as the genuine-empty fallback.

## Error handling

- Commits on a routed session commit each engine's transaction independently — **not
  atomic across DBs**. Acceptable: each ingestion job writes exactly one source; reads
  are unaffected.
- Fixture DB unreachable at request time surfaces as a normal 500 with the DB error —
  same failure mode as the live DB being down; no special handling.
- Degenerate single-DB config: narrowed skip keeps fixture rows out of the live DB, and
  Settings continues to surface the skipped state there.

## Testing

- Unit matrix for `database_url_for` × (global mode, per-source override, fixture URL
  set/unset) and the narrowed `ingestion_skipped_for`.
- Routing tests against **two** Postgres databases (derive a sibling of
  `TEST_DATABASE_URL`, e.g. `<db>_fx`; create via the maintenance DB as bootstrap
  does): prove a fixture-pinned source's rows land in and read from the fixture DB
  while the same table in the live DB stays empty; prove column-only queries and
  upserts route correctly. **[risky seam: two-DB test harness]**
- Feature test: global live + `google_reviews` pinned fixture →
  `research_social_reviews` sees live posts and fixture reviews in one call.
- Frontend: Settings drops the "skipped" surface for the fixture-DB-configured case
  (badge shows *Fixture*); update the RF1 run-all test accordingly.

## Docs to update on landing

- README two-DB routing section and `docs/LIVE_API_VALIDATION.md` mixed-mode skip
  semantics (both graduated in 7183c2b) — rewritten to describe routing + narrowed
  skip.

## Non-goals

- No provenance columns / single-DB merge (physical separation stays).
- No change to which sources can go live (API limits unchanged).
- Live-mode Meta comment ingestion — separate followup (2026-07-22), not this design.
- No dev-console changes; no UI redesign beyond removing the skipped surface.
