# Dashboard Polish & Honesty — Design

**Date:** 2026-07-14
**Branch:** `feature/dashboard-polish`
**Status:** Approved by user (this doc is the written record)

## Goal

A batch of dashboard fixes and transparency features: correct the research
selector, show real progress on slow AI calls, stop re-buying the same LLM
answers on every tab visit, make generated images visible, label live vs
fixture data honestly, add an explicit frontend-serving flag, standardize the
brand name, and rewrite the README for its two real audiences. No new product
features; no data-shape changes to existing endpoints.

## Non-goals

- No Sphinx (user decision: FastAPI's `/docs` + `/openapi.json`, linked from
  the README, are the API reference).
- No job queue / background-task registry (streaming responses instead).
- No changes to existing endpoint response shapes; streaming endpoints are
  additive.
- Known backend follow-ups (internet-trends latest-window scoping,
  `CompetitorIn.name` min-length, competitor-comments endpoint, draft
  mime_type, Canva refresh-token flow) stay out of scope.
- `docs/draft/` is an archive — the "Urban Space" strings in it stay.

---

## 1. Research selector fixes

`frontend/src/views/research/ResearchView.tsx`:

- **Clear all** sets all four sources to `false` (today it hardcodes
  `tr: true`, leaving Internet Trends selected).
- Remove the `toggle` guard that blocks deselecting the last source, and its
  "At least one source must stay selected" toast — zero selected is legal.
- **View Research** is `disabled` when `count === 0` (plus a `.btn:disabled`
  style — dimmed, `cursor: not-allowed` — if the theme lacks one).
- `openTabs` keeps its existing fallback; it can no longer fire with zero
  sources because the button is disabled.

## 2. Real progress for multi-step AI calls (streaming NDJSON)

**User decision:** progress must be real (backend-reported step completion),
not simulated. Only two flows are genuinely multi-step:

| Flow | Steps (live mode) |
|---|---|
| `POST /generate/post` | per option: caption LLM → image-prompt LLM → image gen → Canva upload; `total = options × 4` = **12** for the default 3 |
| `GET /generate/recommendations` | 4 research analysts (parallel) + 1 synthesis = **5** |

### Backend

Two **additive** streaming endpoints in `routes_generate.py`; the sync
originals remain (documented, tested, used by the dev console):

- `POST /generate/post/stream` — same request body as `/generate/post`.
- `GET /generate/recommendations/stream`.

Both return `StreamingResponse` with `media_type="application/x-ndjson"`.
One JSON object per line:

```
{"event":"progress","step":0,"total":12,"label":"Starting…"}
{"event":"progress","step":1,"total":12,"label":"Option 1: caption written"}
…
{"event":"result","data":{ …same JSON as the sync endpoint… }}
```

- A `progress` event is emitted when a step **completes** (`step` = completed
  count). No invented percentages — the bar only moves on real completions.
- On failure the stream emits `{"event":"error","detail":"…"}` and closes;
  nothing is persisted (the post generator commits once, at the end, as
  today).
- Implementation: generator functions beside the existing feature functions —
  `features/generate.py::generate_post_stream` and
  `features/aggregate.py::aggregated_recommendations_stream` — using LangGraph
  `graph.stream(...)` to observe per-node completions. The aggregator's four
  analysts run on real threads in one superstep; their completion events may
  arrive individually or batched — either is acceptable (the bar jumps).
  Each analyst node already opens its own DB session; unchanged.
- FastAPI closes yield-based dependencies (the DB session) only after the
  response finishes streaming, so the generator can keep using the request
  session. Verify in tests.

### Frontend

- `lib/stream.ts`: `streamNdjson<T>(path, init, onProgress)` — `fetch` +
  `ReadableStream` line parsing; resolves on the `result` event, rejects on
  `error` events or transport failure.
- `components/ProgressBar.tsx`: **determinate** variant (`step/total` width +
  step label + "n of N") and **indeterminate** variant (looping CSS
  animation, no numbers).
- `AsyncSection`'s "Loading…" text becomes the indeterminate ProgressBar —
  this upgrades every single-call section (research tabs, home, drafts) with
  no per-view changes.
- GenerateView: `doGenerate` calls the streaming endpoint; a determinate bar
  with the current step label renders in place of the "Generating…" button
  text (button stays disabled while busy).
- AI Recommendations: streamed with a determinate bar on cache miss/refresh
  (see §3).

## 3. Client-side cache for AI endpoints (stop the token burn)

Views unmount on tab switch, so every visit re-fires every `useApi` — six of
those are LLM-backed. Cache the **AI-backed GETs only**, in `localStorage`,
**TTL 24 h**:

| Cache key | Endpoint |
|---|---|
| `weekly-engagement` | `/home/weekly-engagement` |
| `internet-trends` | `/research/internet-trends` |
| `customer-insights` | `/research/customer-insights` |
| `social-reviews` | `/research/social-reviews` |
| `competitor` | `/research/competitor` |
| `recommendations` | `/generate/recommendations` |

Not cached: `/data/*` lists, drafts, config lists, `customer-questions`
(regex-only, no AI), `/config/modes` — cheap reads, and drafts must reflect
writes immediately.

- `lib/cache.ts`: entries stored as `{v: 1, expiresAt, data}` under
  `athena:cache:v1:<key>`. Expired, corrupt, or unparsable entries are
  treated as a miss (and cleared). All `localStorage` access wrapped in
  try/catch (private-mode safe → degrades to plain fetching).
- `hooks/useApi.ts` gains `useCachedApi<T>(key, fn, deps)` — valid cache →
  instant data with **no network call**; miss → fetch then store. `reload()`
  deletes the key, refetches, restores. `useApi` itself is unchanged.
- **Refresh affordances** (all bypass + rewrite the cache):
  - Research header **Refresh** (exists): now clears the *active tab's* AI
    cache key, then remounts via `refreshKey` as today. Other tabs keep
    their cache until their own refresh — deliberate, to keep token spend
    minimal.
  - **Home engagement card** and **AI Recommendations card**: new small
    refresh icon buttons wired to their `reload()`.
- Cached `recommendations` renders instantly with no stream; a miss or
  explicit refresh runs the streaming call with the progress bar (§2), and
  the final result is cached.

## 4. Live vs Fixture badges (per section, data + AI)

**User decision:** badge every section — data sections show their source's
mode, AI-generated sections show the AI mode.

### Backend

`GET /config/modes` (in `routes_config.py`, response model in
`api/schemas.py`), built from `Settings` — no secrets:

```json
{
  "sources": {"meta": "fixture", "google_reviews": "fixture",
               "google_ads": "fixture", "zoho": "live"},
  "ai": {"llm": "live", "image": "fake", "canva": "live"}
}
```

`sources` values come from `settings.source_mode_for(source)`; `ai` from
`llm_mode` / `image_mode` / `canva_mode`.

### Frontend

- `api.modes()` fetched **once per app load** (in-memory only — not
  localStorage; it must reflect env changes on reload) and provided via a
  `ModesContext`. Fetch failure → context stays `undefined` → badges render
  nothing; views never break.
- `components/StatusBadge.tsx`: small filled circle + text to the right.
  - Data sections: green dot **Live** / amber dot **Fixture**.
  - AI sections: green dot **Live AI** / amber dot **Sample AI**.
- Placement map:

| View / section | Badge source |
|---|---|
| Trends: search volume, keyword ranking | `sources.google_ads` |
| Trends: AI Suggested Posts | `ai.llm` |
| Customer: questions, chats banner | `sources.zoho` |
| Customer: AI insights | `ai.llm` |
| Social: own posts / comments | `sources.meta` |
| Social: Google reviews | `sources.google_reviews` |
| Social: AI insights | `ai.llm` |
| Competitor: posts | `sources.meta` |
| Competitor: AI analysis | `ai.llm` |
| Home: engagement AI insights | `ai.llm` |
| Generate: AI Recommendations | `ai.llm` |
| Generate: generated options header | `ai.llm`, plus a "Sample images" pill when `ai.image == "fake"` |

Canva mode is not badged — the Canva button simply exists or not.

## 5. Generated-options images: square

Generated images are 1080×1080; `.gdraft-hdr` is a 76 px-tall strip that
crops them. When an option has an image, the header gets a `has-img`
modifier class (`.gdraft-hdr.has-img { aspect-ratio: 1/1; height: auto; }`
in `theme.css`) so it renders square. The no-image placeholder keeps the
76 px strip.

## 6. Brand name: "Urban Space" → "UrbanSpace"

Replace in user-facing copy and tests (`docs/draft/` excluded):

- `frontend/index.html` `<title>`
- `frontend/src/views/HomeView.tsx` (3), `views/research/ResearchView.tsx`
  (2), `views/GenerateView.tsx` (1), `views/research/CustomerTab.tsx` (1)
- `frontend/src/__tests__/App.test.tsx`
- `tests/api/test_static_dashboard.py`

Final `grep -ri "urban space"` (minus `docs/draft/`, lockfiles,
`node_modules`) must come back empty.

## 7. Frontend serving flag

- `Settings.serve_frontend: bool = True` (env `SERVE_FRONTEND`).
- `api/app.py` mount condition becomes: `serve_frontend` **and**
  `frontend_dist` non-empty **and** the directory exists (the existing
  empty-string guard stays — `Path("")` is the CWD). When disabled, log
  `"dashboard serving disabled"` and serve API-only.
- Documented in `.env.example`, README env table, and the deploy guide.

## 8. README rewrite + relations audit

Rewrite `README.md` for its two audiences:

- **Top:** one-paragraph what-Athena-is; quick links — dashboard URL,
  interactive API docs (`/docs`), raw schema (`/openapi.json`).
- **For the marketing team:** what each view does (Home / Research /
  Generate / Settings), what the Live/Fixture and Live AI/Sample AI badges
  mean, and how caching works (AI answers refresh daily or via the refresh
  buttons).
- **For developers:** quickstart (uv, compose, migrations, run), grouped env
  table (DB, source modes, AI keys, Canva, `SERVE_FRONTEND`), API surface
  tables updated with `/config/modes` and the two `/stream` endpoints,
  testing (pytest + vitest), deployment (`deploy/` guide), frontends
  (dashboard + dev-console), architecture pointer (`docs/diagrams/`).

Relations audit across the repo: `.env.example` (add `SERVE_FRONTEND`),
`deploy/` guide, `docker-compose.yml` comments, and any nested READMEs
(`frontend/`, `dev-console/`, `deploy/`) that mention endpoints, env vars, or
the brand name.

---

## Testing

TDD throughout (superpowers flow). Everything stays keyless via `FakeLLM` /
`FakeImageClient` / `FakeCanvaClient`.

**Backend (pytest):**
- Stream endpoints: iterate the NDJSON body via `TestClient`; assert
  monotonically increasing `step`, correct `total`, a terminal `result` event
  matching the sync endpoint's shape, and rows persisted once.
- Error path: a failing fake LLM yields an `error` event and persists
  nothing.
- `/config/modes`: reflects per-source overrides (`source_mode_for`) and AI
  modes; no secret fields in the payload.
- `serve_frontend=False` → `/` is 404 even when dist exists (variant of
  `test_static_dashboard.py`).

**Frontend (vitest):**
- ResearchView: Clear all → 0 selected; toggling to zero allowed (no toast);
  View Research disabled at zero, enabled at ≥1.
- Cache: hit renders without fetch; expired/corrupt entry refetches;
  `reload()` bypasses; localStorage throwing degrades to fetch.
- Streaming: mocked `ReadableStream` NDJSON → progress states advance, result
  rendered, error event → error state with retry.
- StatusBadge: correct dot/text per mode; nothing rendered when modes fetch
  failed.
- GenerateView: square class present when option has an image; absent
  otherwise.
- UrbanSpace strings in updated tests.

## Error handling summary

| Failure | Behavior |
|---|---|
| Stream transport drop / `error` event | Toast + retry affordance; no partial persistence |
| Corrupt or expired cache entry | Treated as miss, entry cleared, normal fetch |
| `localStorage` unavailable | Cache layer no-ops; plain fetching |
| `/config/modes` fetch fails | Badges hidden; views unaffected |
| Frontend disabled via flag | API-only serving, logged at startup |
