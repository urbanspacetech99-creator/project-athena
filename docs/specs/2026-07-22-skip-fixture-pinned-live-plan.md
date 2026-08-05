# Skip fixture-pinned sources in global live mode — implementation plan

> **Superseded (2026-07-22, same day) by per-source DB routing:** fixture-pinned sources
> are now *routed* to `FIXTURE_DATABASE_URL` in live mode instead of skipped; the skip
> survives only in the single-DB config (no fixture URL). See README "two-DB routing".

## Goal

When global `SOURCE_MODE=live`, ingestion for a source whose per-source override pins it to
fixture (e.g. `GOOGLE_REVIEWS_SOURCE_MODE=fixture`) is skipped — logged and reported as
"skipped" — instead of writing fixture rows into the live `athena` database.

## Context

Audit 2026-07-22: `source_mode_for()` lets a per-source override return `fixture` while the
session (via `active_database_url()`) still targets the live DB, so the 03:00 cron and manual
`POST /ingest/{source}` wrote fixture rows into `athena`. The live DB was purged the same day;
this change stops the re-leak. Decision approved in-chat 2026-07-22 (option: skip, over
routing fixture-pinned writes to the fixture DB or keeping the documented fallback).

## State

- Design: in-chat decision 2026-07-22 (no separate design doc; behaviour fully specified here)
- Base: cd483f6
- M1: done
- M2: done
- RF1: done

## Decomposition

- **Skip predicate (config layer)** — one place that answers "is this source fixture-pinned
  while global mode is live?". Lives next to `source_mode_for` on `Settings` so the semantics
  stay with the mode-resolution logic. Depends on nothing new.
- **Job guard (jobs layer)** — each ingestion job in `ingestion_jobs.py` consults the predicate
  for its source key (`meta`, `google_reviews`, `google_ads`, `zoho`, `google_places`; the two
  competitor jobs use `meta` / `google_places` respectively) and returns a skip marker without
  touching the session. Covers both triggers for free (worker cron and API both call these
  functions). Skip is logged with source + reason.
- **API response (`/ingest/{source}`)** — `IngestResponse` gains `skipped: bool = false`;
  `_to_response` recognises the marker. Non-skip responses unchanged.
- **UI surfacing** — dashboard `SettingsView` shows a "skipped (fixture-pinned in live mode)"
  result instead of "0 new, 0 updated"; run-all treats skips as success, not failure.
  Dev-console renders raw JSON — only its `IngestResponse` type needs the optional field.

## Behaviours to verify

- Given `SOURCE_MODE=live` and a source override `=fixture`, when its ingestion job runs,
  then no rows are written to any DB and the result reports skipped.
- Given `SOURCE_MODE=fixture` (global), when any ingestion job runs, then fixture ingestion
  proceeds into the fixture DB exactly as before (never skipped).
- Given `SOURCE_MODE=live` and a source override `=live` (or empty), when its job runs,
  then live ingestion proceeds unchanged.
- Given a skipped source, when triggered via `POST /ingest/{source}`, then the response has
  `skipped: true` and zero counts.
- Given the Settings page "run" buttons in live mode, when a fixture-pinned source is run,
  then the user sees a skipped notice and run-all continues through remaining sources.

## Milestones

1. Backend skip path: predicate + guard in all six jobs + `skipped` in the ingest response,
   with behavioural tests for the three mode combinations and the route response. [risky]
   Done when: with live global + fixture override, `POST /ingest/google_reviews` returns
   `skipped: true` and the DB row count is unchanged; full backend suite green.
   Risky because: it gates every write into the live `athena` DB (data-integrity seam) — a
   wrong predicate direction would either re-leak fixtures or silently disable fixture-mode
   ingestion (demo path).
2. Frontend surfacing: `skipped` in dashboard + dev-console types, SettingsView notice.
   Done when: SettingsView test covers the skipped rendering; `npm test`/`npm run build`
   (frontend) and `tsc` (dev-console) green.

## Risk / open questions

- The running worker pins `Settings` at boot — after this lands, restart the worker (and API
  container in compose) or tonight's 03:00 run still uses the old code.
- Out of scope, noted in audit: live-mode meta comments are deliberately not ingested;
  compose's `FIXTURE_DATABASE_URL` host mismatch inside Docker.

## Review notes — feature

Independent feature-mode review (subagent, 2026-07-22, diff cd483f6..HEAD): ready —
no Critical/Important findings. Fresh runs: backend 216, frontend 73 + build, dev-console
tsc all green; confirmed the six guarded jobs are the only writers of ingested models and
both triggers route through them. One Minor → RF1: behaviour 5's run-all continuation had
no automated test (held by construction; runOne never throws on skip).
recheck: frontend suite green with a run-all test asserting later sources still POST past
a skipped one. Status: fixed in RF1.
Operational reminder from the reviewer: the fix is inert until the worker/API restart.

## Review notes — M1

Independent milestone-mode review (subagent, 2026-07-22): zero findings — ready to
commit. Verified: full suite 216 green; predicate structurally cannot fire in
fixture-global mode; all six jobs guard before session creation; the guarded jobs are
the only writers of ingested models; claims-vs-diff consistent, no scope creep.
