# Athena — AI Marketing Pipeline for UrbanSpace

Backend + dashboard that ingests UrbanSpace's marketing data (Meta posts/comments, Google
Business reviews, Google Ads keyword volumes, Zoho CRM chat transcripts), runs AI research and
content generation over it (Claude for text, Gemini for images, Canva for the editing handoff),
and serves the results as a marketing dashboard.
Python + FastAPI + LangGraph + Postgres; React + TypeScript dashboard.

**Quick links**

| What | Where |
|---|---|
| Marketing dashboard | `http://localhost:8000/` (bundled build) · `http://localhost:5174` (Vite dev) |
| Interactive API docs (Swagger UI) | `http://localhost:8000/docs` |
| Raw OpenAPI schema | `http://localhost:8000/openapi.json` |
| Deployment guide | [`deploy/README.md`](deploy/README.md) |
| Architecture diagram | `docs/diagrams/architecture.drawio` |
| Live-credential validation checklist | `docs/LIVE_API_VALIDATION.md` |

## For the marketing team

The dashboard has four views:

- **Home** — weekly KPI tiles (views, likes, interactions, posts) and an AI Weekly Summary that flags your top-performing post and surfaces themes from this week's post comments.
- **Research** — pick your data sources, then four tabs: **Internet Trends** (keyword search volumes), **Customer Chats** (questions customers ask + AI insights from Zoho chats), **Social Media** (post performance, comments, Google reviews), and **Competitor Analysis** (tracked competitors' activity + AI strategy). Every AI section offers suggested post titles you can send to Generate with one click.
- **Generate** — brief the AI (platform, tone, length, audience, visual style) and get 3 post options with captions and images; download as PNG, save to drafts, or open in Canva. AI Recommendations synthesize all research sources into ready-to-use ideas.
- **Settings** — manage tracked competitors, keywords, and the AI agents' prompts.

**Live vs Fixture badges.** Each section carries a small dot: green **Live** means real data from the connected service; amber **Fixture** means built-in sample data (shaped like the real thing — used for demos and while credentials are pending). AI sections show **Live AI** (Claude) or **Sample AI** (deterministic placeholder). Which services are live is server configuration — ask your developer.

**Freshness & progress.** AI answers are cached in your browser for 24 hours, so repeat visits are instant and don't re-spend AI credits. Use the ↻ refresh buttons (Research header, AI Weekly Summary, AI Recommendations) to force fresh analysis. Long AI jobs — generating posts, building recommendations — show a real progress bar with step labels.

## For developers

### Quickstart

```bash
uv sync --extra dev
cp .env.example .env          # defaults: fixture data, fake AI — runs with no keys
docker compose up -d db
uv run uvicorn athena.api.app:app --reload   # auto-creates + migrates the DB on startup
# dashboard (dev):
cd frontend && npm install && npm run dev     # http://localhost:5174, proxies to :8000
```

To serve the dashboard from the API instead of the Vite dev server, build it once
(`cd frontend && npm run build`) — it is served at `/` when `frontend/dist` exists, and
turned off with `SERVE_FRONTEND=false`.

### Tests & lint

```bash
uv run pytest            # backend — needs Docker (testcontainers), or set TEST_DATABASE_URL to a Postgres URL
uv run ruff check .
cd frontend && npx vitest run
```

`TEST_DATABASE_URL` (an env var, or a `TEST_DATABASE_URL=` line in `.env`) points the backend
tests at an existing Postgres and skips spinning up a throwaway container — useful where Docker
isn't reachable.

### Configuration

Everything is env-driven via `.env` — see `.env.example` (grouped and commented). Highlights:

| Env | Meaning |
|---|---|
| `DATABASE_URL` | Postgres URL; `DB_AUTO_CREATE=true` (default) creates the DB if missing and migrates to head on startup |
| `SOURCE_MODE` + `META_`/`GOOGLE_REVIEWS_`/`GOOGLE_ADS_`/`ZOHO_SOURCE_MODE` | `fixture` \| `live` per data source (per-source overrides win) |
| `LLM_MODE` + `CLAUDE_API_KEY` | `fake` \| `live` text AI (Claude, default model `claude-sonnet-5`) |
| `IMAGE_MODE` + `GEMINI_API_KEY` | `fake` \| `live` image AI (Gemini) |
| `CANVA_MODE` + Canva tokens | `fake` \| `live` Canva Connect handoff |
| `FRONTEND_DIST`, `SERVE_FRONTEND` | Where the built dashboard lives; whether to serve it at `/` |

The effective mode of every source and AI client is exposed (no secrets) at `GET /config/modes`,
which drives the dashboard's Live/Fixture badges.

The full REST API is documented interactively at `/docs` (Swagger UI) and `/openapi.json`; the
reference below covers every endpoint by tag.

## Data & Ingestion API

The backend exposes a documented REST API (full OpenAPI at `/docs` and `/openapi.json`) that powers both frontends — see [Frontends](#frontends) below.

### Read endpoints (tag: data)
| Method | Path | Description |
|---|---|---|
| GET | /data/own-posts | Own FB/IG posts with views, likes, interactions |
| GET | /data/post-comments | Comments on the team's own posts |
| GET | /data/competitor-posts | Competitor public posts |
| GET | /data/competitor-reviews | Google reviews for tracked competitors |
| GET | /data/google-reviews | Google Business reviews |
| GET | /data/keyword-volumes | Weekly keyword search volumes |
| GET | /data/zoho-chats | Ingested customer chat transcripts |

All read endpoints accept `?limit=` and `?offset=` and return `{ "items": [...], "count": <total> }`.

### Ingestion trigger (tag: ingestion)
| Method | Path | Description |
|---|---|---|
| POST | /ingest/{source} | Run a source's ingestion in its configured mode. `source` ∈ {meta, competitor, google_reviews, google_ads, zoho, competitor_reviews}. Returns `{source, inserted, updated, total}` (total == inserted + updated). |

### Data sources & modes
Each source has a `live | fixture` adapter selected by env. Default is `fixture` (SOURCE_MODE=fixture); override per source:
| Source | Global/override env | Live API |
|---|---|---|
| Meta (own + competitor) | META_SOURCE_MODE | Meta Graph v25.0 |
| Google reviews | GOOGLE_REVIEWS_SOURCE_MODE | Google Business Profile v4 |
| Google Ads keywords | GOOGLE_ADS_SOURCE_MODE | Google Ads v24 (Keyword Planner) |
| Competitor Google reviews | GOOGLE_PLACES_SOURCE_MODE | Google Places API (New) |
| Zoho chats | ZOHO_SOURCE_MODE | Zoho CRM v6 |

Fixtures are shaped to match the documented live API responses (parity-tested), so switching a source to `live` requires only credentials. Competitor data via Meta is gated off by default (`competitor_live_access_enabled=false`) — see design risk R1.

Scheduled ingestion runs in the worker (APScheduler): daily for meta/competitor/reviews/competitor-reviews/zoho, weekly for keywords.

## Home API (tag: home)
| Method | Path | Description |
|---|---|---|
| GET | /home/weekly-kpi | Headline KPI snapshot (posts, views, likes, interactions) over the past 7 days |
| GET | /home/weekly-engagement | This week's top-performing own post plus AI-generated comment insights (summary, themes, sentiment, recurring feedback) |

`/home/weekly-engagement` runs a small LangGraph pipeline: it looks up the top post by interactions, gathers that week's comments, and asks the configured LLM to summarize them. LLM behavior is controlled by `LLM_MODE`:
| LLM_MODE | Behavior |
|---|---|
| `fake` (default) | Deterministic placeholder insights; no API key required |
| `live` | Calls Claude Sonnet (Anthropic) — requires `CLAUDE_API_KEY` (model via `CLAUDE_MODEL`, default `claude-sonnet-5`) |

## Research API (tag: research)
| Method | Path | Description |
|---|---|---|
| GET | /research/internet-trends | Top self-storage search keywords by weekly search volume, plus 5 AI-suggested post titles |
| GET | /research/customer-questions | Raw customer questions extracted from Zoho chat transcripts (regex-based, no AI) |
| GET | /research/customer-insights | AI summary of the past month's customer chats — top requested services, features, and promotions — plus 5 AI-suggested post titles |
| GET | /research/social-reviews | Past week's own-post views, AI-extracted comment topics, and a Google reviews summary, plus 5 AI-suggested post titles |
| GET | /research/competitor | AI activity summary plus titled recommendations for a selected competitor (optional `?competitor=` to scope to one tracked competitor; omit for a cross-competitor sample), plus 5 AI-suggested post titles |

Every endpoint above except `/research/customer-questions` returns the shared Generate handoff — `titles` (5 suggested post titles) and `prefill_prompt` (a ready-made prompt for the post generator) — alongside its own research findings. Like `/home/weekly-engagement`, these endpoints depend on the configured LLM (`LLM_MODE=fake` by default, `live` for Claude Sonnet via Anthropic).

## Generate API (tag: generate)
| Method | Path | Description |
|---|---|---|
| POST | /generate/post | Generate 3 post options, each with a caption, hashtags, an AI image, and a Canva edit link |
| POST | /generate/drafts | Save a draft post |
| GET | /generate/drafts | List saved drafts (`{ "items": [...], "count": <total> }`) |
| GET | /generate/drafts/{id} | Get a saved draft (404 if not found) |
| PATCH | /generate/drafts/{id} | Edit a saved draft's caption and/or platform (404 if not found) |
| DELETE | /generate/drafts/{id} | Delete a saved draft (204 on success, 404 if not found) |
| GET | /generate/recommendations | Aggregated cross-source recommendations: 5 titles + prefill prompt + rationale |
| POST | /generate/post/stream | Streaming variant of `/generate/post` — NDJSON progress events, then a result event |
| GET | /generate/recommendations/stream | Streaming variant of `/generate/recommendations` — 4 analyst events + synthesis, then result |

### Streaming variants
The two `/stream` endpoints emit `application/x-ndjson` — one JSON object per line:
`{"event":"progress","step":n,"total":N,"label":"Option 2: image generated"}` per completed
step, then `{"event":"result","data":…}` (same payload as the non-streaming endpoint), or
`{"event":"error","detail":"…"}` on failure (nothing is persisted on a failed run). The
dashboard uses them to render real progress bars; the non-streaming endpoints remain for
simple callers.

### `POST /generate/post`
Request body (all fields optional; defaults shown):
| Field | Type | Default | Meaning |
|---|---|---|---|
| platform | string | `instagram` | Target platform for tone/format |
| tone | string | `friendly` | Caption voice |
| length | string | `short` | Caption length |
| prefill_prompt | string | `""` | Seed prompt (e.g. a title handed off from the Research API) |
| visual_style | string | `clean_product` | Image art direction |
| include_hashtags | bool | `true` | Append hashtags |
| include_cta | bool | `true` | Include a call to action |
| include_emoji | bool | `false` | Allow emoji in the caption |
| include_pricing | bool | `false` | Mention pricing |
| options | int | `3` | Number of options to generate |

Returns `{ "options": [...] }` where each option has `caption`, `hashtags` (list), `image_b64` (base64-encoded image bytes), `mime_type` (e.g. `image/png`), `canva_edit_url`, and `visual_style`. Each option runs a caption → image-prompt → Gemini image chain and uploads the result to Canva.

### Images & Canva handoff
Generated images are returned inline as **base64** (`image_b64` + `mime_type`) — the caller decodes and displays them; there is no image URL. The `canva_edit_url` is a **deep-link handoff**: opening it drops the user into Canva to finish editing the design. Both are **fake by default** (deterministic placeholder image and a stub Canva URL), so the endpoint runs keyless in dev and tests.

### Modes
Three env vars toggle live vs fake behavior independently (all default to `fake`):
| Env | Default | `live` behavior |
|---|---|---|
| `LLM_MODE` | `fake` | Captions/recommendations via Claude Sonnet (Anthropic) — needs `CLAUDE_API_KEY` |
| `IMAGE_MODE` | `fake` | Images via Google Gemini (default model `gemini-2.5-flash-image`) — needs `GEMINI_API_KEY` (+ `GEMINI_IMAGE_MODEL`) |
| `CANVA_MODE` | `fake` | Real Canva Connect upload + design — needs `CANVA_ACCESS_TOKEN` (+ client credentials) |

Canva refresh tokens rotate and are single-use, so a revoked lineage (e.g. from two
instances refreshing concurrently) can only be recovered by minting a fresh token pair
through the OAuth consent flow. [`scripts/canva_oauth.py`](scripts/canva_oauth.py) runs that
flow (Authorization Code + PKCE) and writes the new pair straight into the app DB — run
`uv run python scripts/canva_oauth.py` and see the file's docstring for the full checklist.

## Config API (tag: config)
CRUD for the Settings views in both the dashboard and the dev console — tracked competitors,
tracked keywords, agent definitions, and skill fragments. All are seeded with UrbanSpace
defaults on first boot (`athena.db.seed`) and editable from then on.

| Method | Path | Description |
|---|---|---|
| GET | /config/competitors | List tracked competitors (optional `?platform=facebook\|instagram\|google` filter) |
| POST | /config/competitors | Add a tracked competitor |
| PATCH | /config/competitors/{id} | Update a competitor's name, external_id, and/or enabled flag |
| DELETE | /config/competitors/{id} | Remove a tracked competitor |
| GET | /config/keywords | List tracked keywords |
| POST | /config/keywords | Track a new keyword |
| PATCH | /config/keywords/{id} | Update a tracked keyword's text and/or enabled flag |
| DELETE | /config/keywords/{id} | Stop tracking a keyword |
| GET | /config/agents | List agent definitions |
| GET | /config/agents/{key} | Get a single agent definition |
| PATCH | /config/agents/{key} | Update an agent's system prompt and/or attached skills |
| GET | /config/agents/{key}/effective-prompt | Resolve an agent's effective prompt (system prompt + attached skill contents) |
| GET | /config/skills | List skill fragments |
| POST | /config/skills | Create a new skill fragment |
| PATCH | /config/skills/{key} | Update a skill fragment's name and/or content |
| DELETE | /config/skills/{key} | Delete a skill fragment and detach it from every agent |
| GET | /config/modes | Effective live/fixture mode of every data source + AI client (drives the dashboard badges; no secrets) |

## Frontends

Two React + TypeScript (Vite) apps sit on top of the API above:

- **`frontend/`** — the marketing dashboard (client-facing). Dev: `cd frontend && npm install && npm run dev` → `http://localhost:5174` (proxies to the API on `:8000`). Production: `cd frontend && npm run build`, then the API serves `frontend/dist` at `http://localhost:8000/` (also bundled into the Docker image, so `docker compose up api` serves it too).
- **`dev-console/`** — the internal dev console for exercising the API by hand (details below). Dev: `cd dev-console && npm install && npm run dev` → `http://localhost:5173` (or `docker compose up dev-console`).

## Dev console (dev-console/)

A minimal Vite + React + TypeScript console for exercising the API above by hand.

- **Local dev:**
  ```bash
  cd dev-console
  npm install
  npm run dev
  ```
  Then open `http://localhost:5173`. The Vite dev server proxies API calls (`/health`, `/data`, `/ingest`, `/home`, `/research`, `/generate`, `/config`) to `http://localhost:8000`, so run the backend too (see Dev quickstart above). Override the proxy target with the `VITE_API_TARGET` env var.
- **What it does:** five tabs — **Data & Ingest** (browse the 6 data resources, trigger the 5 ingestion sources), **Home** (weekly KPI + engagement), **Research** (the 5 research calls, each with a "Send to Generate" handoff that pre-fills the Generate tab), **Generate** (3-option post generator with base64 image preview + Canva deep-link, saved-drafts list with inline caption edit + delete, aggregated recommendations), **Settings** (manage tracked competitors, tracked keywords, agent prompts, and skill fragments via the Config API).
- **Keyless:** everything runs against the backend's default fake/fixture mode, so you can click through every feature with no API keys.
- **Compose:** `docker compose up dev-console` runs the Vite dev server against the `api` service (port bound to `127.0.0.1:5173`).
- **Tests:** `cd dev-console && npm test` (Vitest) and `npm run build`.
