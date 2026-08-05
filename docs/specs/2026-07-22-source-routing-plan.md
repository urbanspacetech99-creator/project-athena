# source-routing — implementation plan

## Goal
Route each sourced table's reads/writes to the DB its effective per-source mode selects, so the dashboard serves live and fixture data side by side while both DBs stay pure.

## State
- Design: docs/specs/2026-07-22-source-routing-design.md
- Base: 6e573e16bb84aede19d6ae40b14b32f4d715b1b4
- M1: done
- M2: done
- M3: done
- M4: done
- RF1: done

## Decomposition
- **Settings routing surface** (`config.py`) — `database_url_for(source)` maps effective mode → DB URL; `ingestion_skipped_for` narrows to the degenerate single-DB-live config. Pure functions of env; everything downstream keys off them.
- **Engine registry + RoutedSession** (`db/base.py`) — owns the model→source map (5 sources, 8 sourced models) and a per-URL engine cache; `get_bind()` resolves mapper *or* clause table → source → engine, default bind = `active_database_url()`. `make_session_factory` keeps its signature; `deps.get_session` and all routes/features untouched.
- **Ingestion jobs** (`jobs/ingestion_jobs.py`) — guard call sites unchanged in shape; narrowed semantics come entirely from Settings. Routed session lands rows in the right DB.
- **Two-DB test harness** (`tests/`) — derive and provision a sibling fixture-test DB from `TEST_DATABASE_URL` (create via maintenance DB, as bootstrap does); fixtures yielding a routed factory with both DBs clean per test.
- **Deploy + docs + frontend alignment** — compose overrides `FIXTURE_DATABASE_URL` to the `db` service; README + `docs/LIVE_API_VALIDATION.md` rewritten from skip semantics to routing; frontend Settings skip surface remains only for the degenerate config (RF1 test stays valid or is adjusted).

## Behaviours to verify
- Global fixture mode: every sourced table reads/writes the fixture DB — behavior identical to today.
- Global live + source pinned fixture (fixture DB configured): that source's ingestion writes rows to the fixture DB; the same table in the live DB stays empty; API reads return the fixture rows.
- Global live: live sources' rows land in and are read from the live DB.
- Column-only aggregate query on a routed table (e.g. `func.max(KeywordVolume.window_date)`) hits that source's DB.
- The `run_ingestion`/`upsert_rows` insert path on a routed table hits that source's DB.
- Mixed mode end-to-end: `research_social_reviews` composes live own-posts with fixture Google reviews in one call.
- Config tables (competitors, agents, …) stay on the active DB in both global modes.
- Degenerate config (live mode, pinned source, no fixture URL): source is skipped as today; run-all continues past it.
- Compose stack: api/worker bootstrap provisions both DBs on the `db` service without crashing.

## Milestones
1. Settings routing surface: `database_url_for` + narrowed `ingestion_skipped_for`, with the unit matrix (global mode × override × fixture-URL set/unset).
   Done when: matrix tests pass; existing config tests stay green.
2. RoutedSession + engine cache + two-DB test harness. [risky]
   Done when: routing tests prove ORM, column-only, and upsert statements each land on the correct DB, and unmapped tables use the default bind.
3. Ingestion + feature composition in mixed mode. [risky]
   Done when: live-global ingestion writes a pinned source's rows only to the fixture DB (live table provably empty — live-DB purity is the asset at risk), and `research_social_reviews` returns insights grounded in fixture reviews + live posts.
4. Deploy compose override, docs rewrite (README + LIVE_API_VALIDATION), frontend skip-surface check; strike the folded compose followup from followups.md.
   Done when: compose config resolves both DB URLs on the `db` service; docs describe routing + narrowed skip; frontend suite green.

## Review notes — M2 (milestone mode, verdict: ready, 0 Critical / 0 Important)
- [fixed] Minor: drift guard one-directional — tighten to equality vs source_id-signature of metadata tables. recheck: routing tests pass.
- [fixed] Minor: `_engine_for_url` check-then-act race on module dict — guard with a lock. recheck: routing tests pass.
- [fixed] Minor: harness leaves routed engines in module cache across drop_all cycles (latent prepared-stmt flake) — dispose/pop the two harness URLs in teardown. recheck: routing tests pass twice in a row.
- [promoted] Followup: multi-source clause silently falls to default bind; whether get_bind should raise needs a design note → followups.md.

## Review notes — M3 (milestone mode, verdict: ready, 0 Critical / 0 Important; reviewer mutation-tested the purity invariant)
- [fixed] Minor: stale skip wording on IngestResponse.skipped (schemas.py:91) — reword to degenerate single-DB config. recheck: normal test run.
- [fixed] Minor: test_skip_fixture_pinned.py relies on FIXTURE_DATABASE_URL absent from env + stale docstring — pass fixture_database_url="" explicitly, update docstring. recheck: that test file passes.

## Review notes — feature review (verdict: ready, 0 Critical / 0 Important, 5 Minors → RF1)
- [fixed] types.ts:63 stale skipped doc comment → degenerate-config wording. recheck: frontend suite.
- [fixed] test_ingest_routes.py:35 missing fixture_database_url="" pin (env-leak class from M3 review) + stale docstring. recheck: api ingest tests.
- [fixed] research.py:114 guard comment present tense → historical pre-routing framing. recheck: normal test run.
- [fixed] .env.example FIXTURE_DATABASE_URL copy → also serves fixture-pinned sources in live mode. recheck: config tests (env.example parse test).
- [fixed] docs/specs/2026-07-22-skip-fixture-pinned-live-plan.md → supersession note at top. recheck: n/a (docs).

## Risk / open questions
- `get_bind` edge coverage is the load-bearing seam (design-flagged): column-only queries and PG `insert ... on conflict` statements must resolve via clause table inspection — M2's tests are the proof.
- Cross-DB commits are non-atomic by design; no job writes two sources, so no mitigation needed.
- (Historical note: during execution these artifacts lived in the local-only
  docs/orchestra/ working area, so State flips never appeared in the milestone commits;
  this archived copy was committed on landing per the documentation map.)
