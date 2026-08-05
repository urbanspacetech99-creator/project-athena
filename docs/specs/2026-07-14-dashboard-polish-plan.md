# Dashboard Polish & Honesty — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the approved spec at `docs/specs/2026-07-14-dashboard-polish-design.md`: research selector fixes, real NDJSON streaming progress for the two multi-step AI flows, a 24 h localStorage cache for AI-backed GETs, per-section Live/Fixture badges, square generated-image cards, the UrbanSpace rename, a `SERVE_FRONTEND` flag, and a two-audience README rewrite.

**Architecture:** Backend adds two *additive* NDJSON streaming endpoints (generator functions beside the existing feature functions; the sync versions are refactored to consume the streams so there is one code path) and a secret-free `GET /config/modes`. Frontend adds three small libs (`lib/cache.ts`, `lib/stream.ts`, `modes.tsx` context) plus two components (`ProgressBar`, `StatusBadge`), then wires them into the existing views. No existing endpoint changes shape.

**Tech Stack:** FastAPI (`StreamingResponse`), LangGraph `graph.stream(stream_mode="updates")`, pydantic-settings; React 18 + TypeScript + Vite, vitest + testing-library, `fetch` + `ReadableStream`, `localStorage`.

**Branch:** `feature/dashboard-polish` (already exists; spec committed as `a75d4fd`).

**Environment notes for the executor:**
- Backend tests: `uv run pytest` from the repo root. They use testcontainers → Docker must be reachable. On this machine Docker lives in WSL; if pytest can't connect, start the project's loopback bridge and set `DOCKER_HOST=tcp://localhost:2375` (see the `env-docker-wsl-bridge` project note).
- Frontend tests: `cd frontend` then `npx vitest run`. Type check/build: `npm run build`.
- All file paths below are relative to the repo root.

---

## File structure

**Backend — modify:**
- `src/athena/config.py` — add `serve_frontend: bool`
- `src/athena/api/app.py` — gate the static mount on the flag
- `src/athena/api/schemas.py` — add `SourceModesOut`, `AiModesOut`, `ModesOut`
- `src/athena/api/routes_config.py` — add `GET /config/modes`
- `src/athena/features/generate.py` — add `generate_post_stream`; `generate_post` consumes it
- `src/athena/features/aggregate.py` — add `aggregated_recommendations_stream`; sync consumes it
- `src/athena/api/routes_generate.py` — add `POST /generate/post/stream`, `GET /generate/recommendations/stream`, `_ndjson` wrapper

**Backend — tests:**
- Modify `tests/api/test_config_routes.py` (modes endpoint)
- Modify `tests/api/test_static_dashboard.py` (flag test; UrbanSpace strings later in Task 14)
- Create `tests/features/test_generate_stream.py`, `tests/features/test_aggregate_stream.py`
- Create `tests/api/test_stream_routes.py`

**Frontend — create:**
- `frontend/src/lib/cache.ts` (+ `frontend/src/__tests__/cache.test.ts`)
- `frontend/src/lib/stream.ts` (+ `frontend/src/__tests__/stream.test.ts`)
- `frontend/src/components/ProgressBar.tsx` (+ `frontend/src/__tests__/ProgressBar.test.tsx`)
- `frontend/src/modes.tsx` and `frontend/src/components/StatusBadge.tsx` (+ `frontend/src/__tests__/StatusBadge.test.tsx`)

**Frontend — modify:**
- `frontend/src/hooks/useApi.ts` (add `useCachedApi`), `frontend/src/__tests__/useApi.test.tsx`
- `frontend/src/api.ts` (add `modes`, `generatePostStream`, `recommendationsStream`)
- `frontend/src/types.ts` (add `Modes`, `StreamProgress`)
- `frontend/src/setupTests.ts` (clear localStorage between tests)
- `frontend/src/components/AsyncSection.tsx`, `frontend/src/components/AiCard.tsx`, `frontend/src/components/SuggestedPosts.tsx`
- `frontend/src/App.tsx` (ModesProvider)
- `frontend/src/views/research/ResearchView.tsx` (+ test), `TrendsTab.tsx`, `CustomerTab.tsx`, `SocialTab.tsx`, `CompetitorTab.tsx`
- `frontend/src/views/HomeView.tsx`, `frontend/src/views/GenerateView.tsx` (+ test)
- `frontend/src/styles/theme.css`
- `frontend/index.html`, `frontend/src/__tests__/App.test.tsx` (rename)

**Docs:** `README.md`, `.env.example`, `deploy/README.md`, `deploy/docker-compose.yml`

---

### Task 1: `GET /config/modes` endpoint

**Files:**
- Modify: `src/athena/api/schemas.py` (append at end)
- Modify: `src/athena/api/routes_config.py`
- Test: `tests/api/test_config_routes.py` (append)

- [ ] **Step 1: Write the failing test**

Append to `tests/api/test_config_routes.py` (add any of these imports the file lacks):

```python
from fastapi.testclient import TestClient

from athena.api import deps
from athena.api.app import create_app
from athena.config import Settings


def test_modes_endpoint_reflects_settings():
    app = create_app()
    app.dependency_overrides[deps.get_settings] = lambda: Settings(
        db_auto_create=False, source_mode="fixture", zoho_source_mode="live",
        llm_mode="live", image_mode="fake", canva_mode="live")
    body = TestClient(app).get("/config/modes").json()
    # Exact equality also proves no extra (secret-bearing) fields leak into the payload.
    assert body == {
        "sources": {"meta": "fixture", "google_reviews": "fixture",
                    "google_ads": "fixture", "zoho": "live"},
        "ai": {"llm": "live", "image": "fake", "canva": "live"},
    }


def test_modes_endpoint_documented():
    spec = TestClient(create_app()).get("/openapi.json").json()
    assert "/config/modes" in spec["paths"]
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `uv run pytest tests/api/test_config_routes.py -q -k modes`
Expected: FAIL — 404 for `/config/modes` (assert on `body` KeyError/mismatch) and missing OpenAPI path.

- [ ] **Step 3: Add the response models**

Append to `src/athena/api/schemas.py`:

```python
class SourceModesOut(BaseModel):
    meta: str
    google_reviews: str
    google_ads: str
    zoho: str


class AiModesOut(BaseModel):
    llm: str
    image: str
    canva: str


class ModesOut(BaseModel):
    sources: SourceModesOut
    ai: AiModesOut
```

- [ ] **Step 4: Add the route**

In `src/athena/api/routes_config.py`, extend the deps import and add the route directly under the `router = APIRouter(...)` line:

```python
from athena.api.deps import get_session, get_settings
from athena.config import Settings
```

```python
@router.get("/modes", response_model=schemas.ModesOut,
            summary="Effective live/fixture mode of every data source and AI client")
def modes(settings: Settings = Depends(get_settings)):
    """Which backing services are real: source adapters report live|fixture, AI
    clients report live|fake. Drives the dashboard's status badges. No secrets."""
    return {
        "sources": {s: settings.source_mode_for(s)
                    for s in ("meta", "google_reviews", "google_ads", "zoho")},
        "ai": {"llm": settings.llm_mode, "image": settings.image_mode,
               "canva": settings.canva_mode},
    }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `uv run pytest tests/api/test_config_routes.py -q`
Expected: PASS (all tests in the file, not just the new ones).

- [ ] **Step 6: Commit**

```bash
git add src/athena/api/schemas.py src/athena/api/routes_config.py tests/api/test_config_routes.py
git commit -m "feat(api): GET /config/modes exposes live/fixture per source + AI client"
```

---

### Task 2: `SERVE_FRONTEND` flag

**Files:**
- Modify: `src/athena/config.py:23` (below `frontend_dist`)
- Modify: `src/athena/api/app.py:49-58`
- Modify: `.env.example`, `deploy/docker-compose.yml`
- Test: `tests/api/test_static_dashboard.py` (append)

- [ ] **Step 1: Write the failing test**

Append to `tests/api/test_static_dashboard.py`:

```python
def test_flag_disables_dashboard_serving(tmp_path):
    (tmp_path / "index.html").write_text("<html></html>", encoding="utf-8")
    app = create_app(_settings(frontend_dist=str(tmp_path), serve_frontend=False))
    client = TestClient(app)
    assert client.get("/").status_code == 404
    assert client.get("/health").status_code == 200
```

- [ ] **Step 2: Run it to verify it fails**

Run: `uv run pytest tests/api/test_static_dashboard.py -q`
Expected: FAIL — `Settings` has no field `serve_frontend` (pydantic ValidationError… actually `extra="ignore"` means the kwarg is silently dropped, so the test fails on `client.get("/").status_code == 404` because the dashboard still mounts). Either failure mode is the red we want.

- [ ] **Step 3: Add the setting**

In `src/athena/config.py`, directly below the `frontend_dist` field:

```python
    # Master switch for serving the dashboard at "/". Set false to run API-only
    # even when a built frontend_dist directory exists.
    serve_frontend: bool = True
```

- [ ] **Step 4: Gate the mount**

In `src/athena/api/app.py`, replace the mount block:

```python
    # The empty-string check matters: Path("") is the CWD and is_dir() is True,
    # which would mount the entire working directory at "/".
    dist = Path(settings.frontend_dist)
    if settings.frontend_dist and dist.is_dir():
        from fastapi.staticfiles import StaticFiles
        # Mounted last so every API route above takes priority — add new routers ABOVE this block.
        app.mount("/", StaticFiles(directory=dist, html=True), name="dashboard")
        log.info("serving dashboard", extra={"dist": str(dist)})
```

with:

```python
    # The empty-string check matters: Path("") is the CWD and is_dir() is True,
    # which would mount the entire working directory at "/".
    dist = Path(settings.frontend_dist)
    if not settings.serve_frontend:
        log.info("dashboard serving disabled", extra={"serve_frontend": False})
    elif settings.frontend_dist and dist.is_dir():
        from fastapi.staticfiles import StaticFiles
        # Mounted last so every API route above takes priority — add new routers ABOVE this block.
        app.mount("/", StaticFiles(directory=dist, html=True), name="dashboard")
        log.info("serving dashboard", extra={"dist": str(dist)})
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `uv run pytest tests/api/test_static_dashboard.py -q`
Expected: PASS (6 tests).

- [ ] **Step 6: Document the env var**

In `.env.example`, directly below the `FRONTEND_DIST=` line, add:

```
# Serve the dashboard at "/" when the dist exists. true | false (default: true)
SERVE_FRONTEND=
```

In `deploy/docker-compose.yml`, in the `x-app-env: &app_env` block directly below the `- FRONTEND_DIST=` line, add:

```yaml
  - SERVE_FRONTEND=          # (optional) true|false, default true — false = API-only, no dashboard at "/"
```

- [ ] **Step 7: Commit**

```bash
git add src/athena/config.py src/athena/api/app.py tests/api/test_static_dashboard.py .env.example deploy/docker-compose.yml
git commit -m "feat(api): SERVE_FRONTEND flag to toggle dashboard serving"
```

---

### Task 3: `generate_post_stream` generator (backend feature)

**Files:**
- Modify: `src/athena/features/generate.py`
- Test: Create `tests/features/test_generate_stream.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/features/test_generate_stream.py`:

```python
from athena.ai.images import FakeImageClient
from athena.ai.llm import default_fake_llm
from athena.db.models import GeneratedPost
from athena.features.generate import generate_post_stream
from athena.integrations.canva import FakeCanvaClient

BRIEF = {"platform": "instagram", "tone": "friendly", "length": "short",
         "prefill_prompt": "Promote climate-controlled units",
         "visual_style": "clean_product",
         "include_hashtags": True, "include_cta": True,
         "include_emoji": False, "include_pricing": False}


def _events(session, options):
    return list(generate_post_stream(session, default_fake_llm(), FakeImageClient(),
                                     FakeCanvaClient(), BRIEF, options=options))


def test_stream_emits_ordered_progress_then_result(session):
    events = _events(session, options=2)
    progress = [e for e in events if e["event"] == "progress"]
    # step 0 = "Starting…", then 2 options × (3 graph nodes + 1 Canva upload) = 8 more
    assert [p["step"] for p in progress] == list(range(9))
    assert {p["total"] for p in progress} == {8}
    assert progress[1]["label"] == "Option 1: caption written"
    assert progress[4]["label"] == "Option 1: Canva design created"
    assert progress[5]["label"] == "Option 2: caption written"
    assert events[-1]["event"] == "result"
    assert len(events[-1]["data"]["options"]) == 2


def test_stream_result_matches_sync_shape_and_persists(session):
    events = _events(session, options=3)
    options = events[-1]["data"]["options"]
    for opt in options:
        assert opt["caption"]
        assert opt["image_b64"] and opt["mime_type"].startswith("image/")
        assert opt["canva_edit_url"].startswith("https://www.canva.com/design/")
        assert opt["visual_style"]
    assert session.query(GeneratedPost).count() == 3
```

- [ ] **Step 2: Run them to verify they fail**

Run: `uv run pytest tests/features/test_generate_stream.py -q`
Expected: FAIL — `ImportError: cannot import name 'generate_post_stream'`.

- [ ] **Step 3: Implement the generator; make `generate_post` consume it**

In `src/athena/features/generate.py`, replace the whole `generate_post` function (keep everything above it, including `build_post_option_graph`) with:

```python
_STEP_LABEL = {"caption": "caption written", "image_prompt": "image prompt designed",
               "image": "image generated"}


def generate_post_stream(session: Session, llm: LLMClient, image_client: ImageClient,
                         canva: CanvaClient, brief: dict, options: int = 3):
    """Streaming variant of Feature 8: yields a progress event dict per completed step
    (3 graph nodes + 1 Canva upload per option; total = options*4), then one result
    event. Persists all rows in a single commit at the end, exactly like generate_post —
    a mid-stream failure persists nothing."""
    graph = build_post_option_graph(
        llm, image_client,
        caption_system=resolve_agent_prompt(session, "caption_writer"),
        image_prompt_system=resolve_agent_prompt(session, "image_prompt_designer"))
    now = datetime.now(timezone.utc)
    total = options * 4
    step = 0
    result: list[dict[str, Any]] = []
    log.info("post generation start", extra={"platform": brief.get("platform"), "options": options})
    yield {"event": "progress", "step": 0, "total": total, "label": "Starting…"}
    for i in range(options):
        state: dict[str, Any] = {"brief": brief, "option_index": i,
                                 "caption": None, "image_prompt": None, "image": None}
        for update in graph.stream(state, stream_mode="updates"):
            for node, values in update.items():
                state.update(values)
                step += 1
                yield {"event": "progress", "step": step, "total": total,
                       "label": f"Option {i + 1}: {_STEP_LABEL.get(node, node)}"}
        caption: PostCaption = state["caption"]
        spec: ImagePromptSpec = state["image_prompt"]
        image: GeneratedImage = state["image"]
        handoff = canva.upload_and_edit_url(image, title=f"{brief.get('platform', 'post')}-{i + 1}")
        step += 1
        yield {"event": "progress", "step": step, "total": total,
               "label": f"Option {i + 1}: Canva design created"}
        session.add(GeneratedPost(
            platform=brief["platform"], caption=caption.caption, image_url="",
            image_b64=image.data_b64, canva_edit_url=handoff.edit_url,
            source_feature="post_generator", prefill_prompt=brief.get("prefill_prompt", ""),
            visual_style=spec.visual_style, created_at=now))
        result.append({
            "caption": caption.caption, "hashtags": caption.hashtags,
            "image_b64": image.data_b64, "mime_type": image.mime_type,
            "canva_edit_url": handoff.edit_url, "visual_style": spec.visual_style})
    session.commit()
    log.info("post generation done", extra={"options": len(result)})
    yield {"event": "result", "data": {"options": result}}


def generate_post(session: Session, llm: LLMClient, image_client: ImageClient,
                  canva: CanvaClient, brief: dict, options: int = 3) -> dict:
    """Feature 8: run the caption->image_prompt->image chain `options` times, upload each to
    Canva, persist an audit row per option, and return the option list."""
    for event in generate_post_stream(session, llm, image_client, canva, brief, options):
        if event["event"] == "result":
            return event["data"]
    raise RuntimeError("post generation stream ended without a result")
```

- [ ] **Step 4: Run the new tests AND the existing sync tests**

Run: `uv run pytest tests/features/test_generate_stream.py tests/features/test_generate_post.py -q`
Expected: PASS (the sync tests prove the consume-the-stream refactor is behavior-preserving).

- [ ] **Step 5: Commit**

```bash
git add src/athena/features/generate.py tests/features/test_generate_stream.py
git commit -m "feat(generate): stream per-step progress events from post generation"
```

---

### Task 4: `aggregated_recommendations_stream` generator (backend feature)

**Files:**
- Modify: `src/athena/features/aggregate.py`
- Test: Create `tests/features/test_aggregate_stream.py`

- [ ] **Step 1: Write the failing test**

Create `tests/features/test_aggregate_stream.py`:

```python
from datetime import datetime, timezone

from athena.ai.llm import default_fake_llm
from athena.db.models import CompetitorPost, GoogleReview, KeywordVolume, OwnPost, ZohoChat
from athena.features.aggregate import aggregated_recommendations_stream

NOW = datetime.now(timezone.utc)


def _seed(session):
    session.add(KeywordVolume(source_id="k1", window_date=NOW, keyword="self storage",
                              weekly_search_volume=100))
    session.add(OwnPost(source_id="p1", window_date=NOW, platform="instagram", title="t",
                        content="tour", views=1, likes=1, interactions=1))
    session.add(GoogleReview(source_id="r1", window_date=NOW, star_rating=5, comment="good",
                             reviewer="A"))
    session.add(CompetitorPost(source_id="c1", window_date=NOW, competitor="BoxCo", text="x"))
    session.add(ZohoChat(source_id="z1", window_date=NOW, transcript="Customer: price?"))
    session.commit()


def test_aggregator_stream_five_steps_then_result(session):
    _seed(session)
    events = list(aggregated_recommendations_stream(session, default_fake_llm()))
    progress = [e for e in events if e["event"] == "progress"]
    assert [p["step"] for p in progress] == list(range(6))  # 0..5 = start + 4 analysts + synthesis
    assert {p["total"] for p in progress} == {5}
    # Analysts run in parallel threads — order varies; assert the label SET.
    assert {p["label"] for p in progress[1:]} == {
        "Analyzed internet trends", "Analyzed customer chats",
        "Analyzed social & reviews", "Analyzed competitors",
        "Synthesized recommendations"}
    assert events[-1]["event"] == "result"
    assert len(events[-1]["data"]["titles"]) == 5
    assert events[-1]["data"]["rationale"]
```

- [ ] **Step 2: Run it to verify it fails**

Run: `uv run pytest tests/features/test_aggregate_stream.py -q`
Expected: FAIL — `ImportError: cannot import name 'aggregated_recommendations_stream'`.

- [ ] **Step 3: Implement; make the sync function consume the stream**

In `src/athena/features/aggregate.py`, replace the `aggregated_recommendations` function with:

```python
_NODE_LABEL = {"internet_trends": "Analyzed internet trends",
               "customer_insights": "Analyzed customer chats",
               "social_reviews": "Analyzed social & reviews",
               "competitor": "Analyzed competitors",
               "synthesis": "Synthesized recommendations"}


def aggregated_recommendations_stream(session: Session, llm: LLMClient):
    """Streaming variant of Feature 10: one progress event per completed node
    (4 parallel analysts + synthesis; total = 5), then one result event. Analyst
    events may arrive in any order — they run on real threads in one superstep."""
    graph = build_aggregator_graph(session, llm)
    total = 5
    step = 0
    rec: AggregatedRecommendations | None = None
    yield {"event": "progress", "step": 0, "total": total, "label": "Starting…"}
    for update in graph.stream({"findings": [], "result": None}, stream_mode="updates"):
        for node, values in update.items():
            step += 1
            yield {"event": "progress", "step": step, "total": total,
                   "label": _NODE_LABEL.get(node, node)}
            if node == "synthesis":
                rec = values["result"]
    if rec is None:
        raise RuntimeError("aggregator stream ended without a synthesis result")
    yield {"event": "result",
           "data": {"titles": rec.titles, "prefill_prompt": rec.prefill_prompt,
                    "rationale": rec.rationale}}


def aggregated_recommendations(session: Session, llm: LLMClient) -> dict:
    for event in aggregated_recommendations_stream(session, llm):
        if event["event"] == "result":
            return event["data"]
    raise RuntimeError("aggregator stream ended without a result")
```

- [ ] **Step 4: Run new + existing aggregate tests**

Run: `uv run pytest tests/features/test_aggregate_stream.py tests/features/test_aggregate.py -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/athena/features/aggregate.py tests/features/test_aggregate_stream.py
git commit -m "feat(generate): stream analyst/synthesis progress from the aggregator"
```

---

### Task 5: NDJSON streaming routes

**Files:**
- Modify: `src/athena/api/routes_generate.py`
- Test: Create `tests/api/test_stream_routes.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/api/test_stream_routes.py`:

```python
import json
from datetime import datetime, timezone

from fastapi.testclient import TestClient

from athena.ai.llm import FakeLLM
from athena.api import deps
from athena.api.app import create_app
from athena.db.models import (CompetitorPost, GeneratedPost, GoogleReview, KeywordVolume,
                              OwnPost, ZohoChat)

NOW = datetime.now(timezone.utc)


def _client(session):
    app = create_app()
    app.dependency_overrides[deps.get_session] = lambda: session
    return TestClient(app)


def _lines(res):
    return [json.loads(line) for line in res.text.strip().splitlines()]


def test_post_stream_emits_progress_then_result(session):
    res = _client(session).post("/generate/post/stream",
                                json={"platform": "instagram", "prefill_prompt": "units"})
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("application/x-ndjson")
    lines = _lines(res)
    progress = [ln for ln in lines if ln["event"] == "progress"]
    assert [p["step"] for p in progress] == list(range(13))  # 0..12 = start + 3 options × 4
    assert all(p["total"] == 12 for p in progress)
    assert lines[-1]["event"] == "result"
    assert len(lines[-1]["data"]["options"]) == 3
    assert session.query(GeneratedPost).count() == 3


def test_post_stream_failure_emits_error_event_and_persists_nothing(session):
    app = create_app()
    app.dependency_overrides[deps.get_session] = lambda: session
    # No schemas registered -> the first structured() call raises KeyError mid-stream.
    app.dependency_overrides[deps.get_llm] = lambda: FakeLLM({})
    res = TestClient(app).post("/generate/post/stream", json={"platform": "instagram"})
    assert res.status_code == 200  # status was already sent when the failure happened
    lines = _lines(res)
    assert lines[-1]["event"] == "error"
    assert lines[-1]["detail"]
    assert session.query(GeneratedPost).count() == 0


def test_recommendations_stream_emits_five_steps_then_result(session):
    session.add(KeywordVolume(source_id="k1", window_date=NOW, keyword="self storage",
                              weekly_search_volume=100))
    session.add(OwnPost(source_id="p1", window_date=NOW, platform="instagram", title="t",
                        content="tour", views=1, likes=1, interactions=1))
    session.add(GoogleReview(source_id="r1", window_date=NOW, star_rating=5, comment="good",
                             reviewer="A"))
    session.add(CompetitorPost(source_id="c1", window_date=NOW, competitor="BoxCo", text="x"))
    session.add(ZohoChat(source_id="z1", window_date=NOW, transcript="Customer: price?"))
    session.commit()
    res = _client(session).get("/generate/recommendations/stream")
    lines = _lines(res)
    progress = [ln for ln in lines if ln["event"] == "progress"]
    assert [p["step"] for p in progress] == list(range(6))
    assert lines[-1]["event"] == "result"
    assert len(lines[-1]["data"]["titles"]) == 5


def test_stream_endpoints_documented():
    spec = TestClient(create_app()).get("/openapi.json").json()
    assert "/generate/post/stream" in spec["paths"]
    assert "/generate/recommendations/stream" in spec["paths"]
```

- [ ] **Step 2: Run them to verify they fail**

Run: `uv run pytest tests/api/test_stream_routes.py -q`
Expected: FAIL — 404 on both `/stream` paths.

- [ ] **Step 3: Implement the routes**

In `src/athena/api/routes_generate.py`, replace the import block at the top with:

```python
import json
from collections.abc import Iterable, Iterator

from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from athena.api import schemas
from athena.api.deps import get_canva_client, get_image_client, get_llm, get_session
from athena.features import aggregate, drafts, generate
from athena.logging_setup import get_logger

log = get_logger("athena.api.generate")

router = APIRouter(prefix="/generate", tags=["generate"])

_NDJSON = "application/x-ndjson"


def _ndjson(events: Iterable[dict]) -> Iterator[str]:
    """Serialize event dicts to NDJSON lines. A mid-stream exception becomes a terminal
    error event — the 200 status is already on the wire by then."""
    try:
        for event in events:
            yield json.dumps(event, default=str) + "\n"
    except Exception as exc:
        log.exception("stream failed")
        yield json.dumps({"event": "error", "detail": str(exc)}) + "\n"
```

Then add the two endpoints directly below the existing `generate_post` endpoint:

```python
@router.post("/post/stream",
             summary="Generate post options, streaming NDJSON progress events",
             response_description="NDJSON: progress events, then one result event")
def generate_post_stream(body: schemas.GeneratePostIn, session: Session = Depends(get_session),
                         llm=Depends(get_llm), image_client=Depends(get_image_client),
                         canva=Depends(get_canva_client)):
    """Streaming variant of POST /generate/post. One JSON object per line:
    `{"event":"progress","step":n,"total":options*4,"label":"…"}` per completed step,
    then `{"event":"result","data":…}` (same shape as /generate/post), or
    `{"event":"error","detail":"…"}` on failure."""
    events = generate.generate_post_stream(session, llm, image_client, canva,
                                           body.model_dump(), options=body.options)
    return StreamingResponse(_ndjson(events), media_type=_NDJSON)
```

And directly below the existing `recommendations` endpoint:

```python
@router.get("/recommendations/stream",
            summary="Aggregated recommendations, streaming NDJSON progress events",
            response_description="NDJSON: progress events, then one result event")
def recommendations_stream(session: Session = Depends(get_session), llm=Depends(get_llm)):
    """Streaming variant of GET /generate/recommendations: one progress event per research
    analyst (4, parallel — order varies) + synthesis (1), then
    `{"event":"result","data":{titles,prefill_prompt,rationale}}`."""
    events = aggregate.aggregated_recommendations_stream(session, llm)
    return StreamingResponse(_ndjson(events), media_type=_NDJSON)
```

- [ ] **Step 4: Run the tests**

Run: `uv run pytest tests/api/test_stream_routes.py tests/api/test_generate_routes.py -q`
Expected: PASS.

- [ ] **Step 5: Run the whole backend suite + lint**

Run: `uv run pytest -q && uv run ruff check .`
Expected: all pass, no lint errors.

- [ ] **Step 6: Commit**

```bash
git add src/athena/api/routes_generate.py tests/api/test_stream_routes.py
git commit -m "feat(api): NDJSON streaming endpoints for post generation + recommendations"
```

---

### Task 6: Frontend cache library

**Files:**
- Create: `frontend/src/lib/cache.ts`
- Modify: `frontend/src/setupTests.ts`
- Test: Create `frontend/src/__tests__/cache.test.ts`

All frontend commands run from `frontend/`.

- [ ] **Step 1: Update setupTests so cache state never leaks between tests**

Replace `frontend/src/setupTests.ts` with:

```ts
import "@testing-library/jest-dom";
import { afterEach } from "vitest";

// lib/cache.ts persists AI responses in localStorage — never leak between tests.
afterEach(() => localStorage.clear());
```

- [ ] **Step 2: Write the failing tests**

Create `frontend/src/__tests__/cache.test.ts`:

```ts
import { afterEach, expect, test, vi } from "vitest";
import { cacheDelete, cacheGet, cacheSet, DAY_MS } from "../lib/cache";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

test("set/get roundtrip", () => {
  cacheSet("k", { a: 1 });
  expect(cacheGet("k")).toEqual({ a: 1 });
});

test("delete removes the entry", () => {
  cacheSet("k", "v");
  cacheDelete("k");
  expect(cacheGet("k")).toBeUndefined();
});

test("expired entries are a miss and get removed", () => {
  vi.useFakeTimers();
  cacheSet("k", "v");
  vi.setSystemTime(Date.now() + DAY_MS + 1);
  expect(cacheGet("k")).toBeUndefined();
  expect(localStorage.getItem("athena:cache:v1:k")).toBeNull();
});

test("corrupt entries are a miss", () => {
  localStorage.setItem("athena:cache:v1:k", "{not json");
  expect(cacheGet("k")).toBeUndefined();
});

test("storage failures degrade to a no-op", () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
  expect(() => cacheSet("k", "v")).not.toThrow();
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `npx vitest run src/__tests__/cache.test.ts`
Expected: FAIL — cannot resolve `../lib/cache`.

- [ ] **Step 4: Implement**

Create `frontend/src/lib/cache.ts`:

```ts
/** localStorage cache for expensive AI GETs. Fail-open: storage errors and
 *  corrupt/expired entries are a miss, so private mode degrades to plain fetching. */
const PREFIX = "athena:cache:v1:";
export const DAY_MS = 24 * 60 * 60 * 1000;

interface Entry<T> { v: 1; expiresAt: number; data: T }

export function cacheGet<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw === null) return undefined;
    const entry = JSON.parse(raw) as Entry<T>;
    if (entry.v !== 1 || typeof entry.expiresAt !== "number" || Date.now() >= entry.expiresAt) {
      localStorage.removeItem(PREFIX + key);
      return undefined;
    }
    return entry.data;
  } catch {
    return undefined;
  }
}

export function cacheSet<T>(key: string, data: T, ttlMs: number = DAY_MS): void {
  try {
    const entry: Entry<T> = { v: 1, expiresAt: Date.now() + ttlMs, data };
    localStorage.setItem(PREFIX + key, JSON.stringify(entry));
  } catch { /* storage unavailable or full — cache is best-effort */ }
}

export function cacheDelete(key: string): void {
  try { localStorage.removeItem(PREFIX + key); } catch { /* best-effort */ }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/__tests__/cache.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/cache.ts frontend/src/__tests__/cache.test.ts frontend/src/setupTests.ts
git commit -m "feat(dashboard): localStorage cache lib (24h TTL, fail-open)"
```

---

### Task 7: `useCachedApi` hook

**Files:**
- Modify: `frontend/src/hooks/useApi.ts`
- Test: `frontend/src/__tests__/useApi.test.tsx` (append)

- [ ] **Step 1: Write the failing tests**

Append to `frontend/src/__tests__/useApi.test.tsx` (add these imports if the file lacks them: `render`, `screen` from `@testing-library/react`; `userEvent` from `@testing-library/user-event`; `vi` from `vitest`; `cacheGet`, `cacheSet` from `../lib/cache`; `useCachedApi` from `../hooks/useApi`):

```tsx
function CachedProbe({ k, fn }: { k: string; fn: () => Promise<unknown> }) {
  const q = useCachedApi(k, fn);
  return (
    <div>
      {q.loading ? "loading" : q.error !== undefined ? `error:${q.error}` : `data:${JSON.stringify(q.data)}`}
      <button onClick={q.reload}>reload</button>
    </div>
  );
}

test("useCachedApi: fresh cache serves without calling fn", async () => {
  cacheSet("k1", { n: 1 });
  const fn = vi.fn(() => Promise.resolve({ n: 2 }));
  render(<CachedProbe k="k1" fn={fn} />);
  expect(await screen.findByText('data:{"n":1}')).toBeInTheDocument();
  expect(fn).not.toHaveBeenCalled();
});

test("useCachedApi: miss fetches and stores", async () => {
  const fn = vi.fn(() => Promise.resolve({ n: 2 }));
  render(<CachedProbe k="k2" fn={fn} />);
  expect(await screen.findByText('data:{"n":2}')).toBeInTheDocument();
  expect(cacheGet("k2")).toEqual({ n: 2 });
});

test("useCachedApi: reload bypasses and rewrites the cache", async () => {
  cacheSet("k3", { n: 1 });
  const fn = vi.fn(() => Promise.resolve({ n: 9 }));
  render(<CachedProbe k="k3" fn={fn} />);
  await screen.findByText('data:{"n":1}');
  await userEvent.click(screen.getByRole("button", { name: "reload" }));
  expect(await screen.findByText('data:{"n":9}')).toBeInTheDocument();
  expect(fn).toHaveBeenCalledTimes(1);
  expect(cacheGet("k3")).toEqual({ n: 9 });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/__tests__/useApi.test.tsx`
Expected: FAIL — `useCachedApi` is not exported.

- [ ] **Step 3: Implement**

Append to `frontend/src/hooks/useApi.ts` (and add `import { cacheDelete, cacheGet, cacheSet } from "../lib/cache";` at the top):

```ts
/** useApi + localStorage cache (24 h TTL). A fresh cache entry renders instantly with
 *  NO network call; `reload()` busts the entry and refetches. Use for AI-backed GETs
 *  only — cheap /data reads and anything that must reflect writes stay on useApi. */
export function useCachedApi<T>(key: string, fn: () => Promise<T>, deps: unknown[] = []): Query<T> {
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: true });
  const [tick, setTick] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    let alive = true;
    const cached = cacheGet<T>(key);
    if (cached !== undefined) { setState({ data: cached, loading: false }); return; }
    setState({ loading: true });
    fnRef.current().then(
      (data) => { cacheSet(key, data); if (alive) setState({ data, loading: false }); },
      (err: unknown) => { if (alive) setState({ error: err instanceof Error ? err.message : String(err), loading: false }); },
    );
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, key, tick]);

  return { ...state, reload: () => { cacheDelete(key); setTick((t) => t + 1); } };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/__tests__/useApi.test.tsx`
Expected: PASS (existing + 3 new).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/useApi.ts frontend/src/__tests__/useApi.test.tsx
git commit -m "feat(dashboard): useCachedApi hook (cache-first, reload busts)"
```

---

### Task 8: NDJSON stream client + api additions + types

**Files:**
- Create: `frontend/src/lib/stream.ts`
- Modify: `frontend/src/types.ts`, `frontend/src/api.ts`
- Test: Create `frontend/src/__tests__/stream.test.ts`

- [ ] **Step 1: Add the types**

Append to `frontend/src/types.ts`:

```ts
export interface Modes {
  sources: { meta: string; google_reviews: string; google_ads: string; zoho: string };
  ai: { llm: string; image: string; canva: string };
}
export interface StreamProgress { step: number; total: number; label: string }
```

- [ ] **Step 2: Write the failing tests**

Create `frontend/src/__tests__/stream.test.ts`:

```ts
import { afterEach, expect, test, vi } from "vitest";
import { streamNdjson } from "../lib/stream";
import type { StreamProgress } from "../types";

afterEach(() => vi.restoreAllMocks());

const ndjsonBody = (lines: unknown[]) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder();
      for (const l of lines) controller.enqueue(enc.encode(JSON.stringify(l) + "\n"));
      controller.close();
    },
  });

const stubStream = (lines: unknown[], ok = true) =>
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(
    { ok, status: ok ? 200 : 500, statusText: ok ? "OK" : "ERR", body: ndjsonBody(lines) })));

test("reports progress events then resolves with the result data", async () => {
  stubStream([
    { event: "progress", step: 0, total: 2, label: "Starting…" },
    { event: "progress", step: 1, total: 2, label: "half" },
    { event: "result", data: { x: 1 } },
  ]);
  const seen: StreamProgress[] = [];
  const out = await streamNdjson<{ x: number }>("/p", {}, (p) => seen.push(p));
  expect(out).toEqual({ x: 1 });
  expect(seen.map((s) => s.step)).toEqual([0, 1]);
  expect(seen[1].label).toBe("half");
});

test("an error event rejects with its detail", async () => {
  stubStream([{ event: "progress", step: 0, total: 2, label: "Starting…" },
              { event: "error", detail: "llm exploded" }]);
  await expect(streamNdjson("/p", {}, () => {})).rejects.toThrow("llm exploded");
});

test("a stream that ends without a result rejects", async () => {
  stubStream([{ event: "progress", step: 0, total: 2, label: "Starting…" }]);
  await expect(streamNdjson("/p", {}, () => {})).rejects.toThrow(/without a result/);
});

test("a non-ok response rejects", async () => {
  stubStream([], false);
  await expect(streamNdjson("/p", {}, () => {})).rejects.toThrow("500 ERR");
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `npx vitest run src/__tests__/stream.test.ts`
Expected: FAIL — cannot resolve `../lib/stream`.

- [ ] **Step 4: Implement**

Create `frontend/src/lib/stream.ts`:

```ts
import type { StreamProgress } from "../types";

interface StreamEvent {
  event: "progress" | "result" | "error";
  step?: number; total?: number; label?: string;
  data?: unknown; detail?: string;
}

/** Consume an NDJSON streaming endpoint: forwards progress events to `onProgress`,
 *  resolves with the terminal result event's data, rejects on error events,
 *  transport failure, or a stream that ends without a result. */
export async function streamNdjson<T>(url: string, init: RequestInit,
                                      onProgress: (p: StreamProgress) => void): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok || !res.body) throw new Error(`${res.status} ${res.statusText}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: T | undefined;
  let gotResult = false;
  const handle = (line: string) => {
    if (!line.trim()) return;
    const ev = JSON.parse(line) as StreamEvent;
    if (ev.event === "error") throw new Error(ev.detail || "stream failed");
    if (ev.event === "result") { result = ev.data as T; gotResult = true; }
    if (ev.event === "progress")
      onProgress({ step: ev.step ?? 0, total: ev.total ?? 1, label: ev.label ?? "" });
  };
  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) handle(line);
  }
  handle(buffer);
  if (!gotResult) throw new Error("stream ended without a result");
  return result as T;
}
```

- [ ] **Step 5: Add the api functions**

In `frontend/src/api.ts`:
- Extend the type import to include `Modes` and `StreamProgress`.
- Add below the other imports: `import { streamNdjson } from "./lib/stream";`
- Add inside the `api` object, after `recommendations`:

```ts
  recommendationsStream: (onProgress: (p: StreamProgress) => void) =>
    streamNdjson<Recommendations>(API_BASE + "/generate/recommendations/stream", {}, onProgress),
  generatePostStream: (body: GeneratePostIn, onProgress: (p: StreamProgress) => void) =>
    streamNdjson<GeneratePostOut>(API_BASE + "/generate/post/stream",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
      onProgress),
  modes: () => request<Modes>("/config/modes"),
```

- [ ] **Step 6: Run tests + type check**

Run: `npx vitest run src/__tests__/stream.test.ts && npm run build`
Expected: tests PASS; the build (which type-checks) succeeds.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/lib/stream.ts frontend/src/__tests__/stream.test.ts frontend/src/types.ts frontend/src/api.ts
git commit -m "feat(dashboard): NDJSON stream client + modes/stream api calls"
```

---

### Task 9: ProgressBar component + AsyncSection upgrade + CSS

**Files:**
- Create: `frontend/src/components/ProgressBar.tsx`
- Modify: `frontend/src/components/AsyncSection.tsx`, `frontend/src/styles/theme.css`
- Test: Create `frontend/src/__tests__/ProgressBar.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/__tests__/ProgressBar.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { ProgressBar } from "../components/ProgressBar";

test("renders indeterminate with generic label when no progress given", () => {
  render(<ProgressBar />);
  expect(screen.getByText("Loading…")).toBeInTheDocument();
});

test("renders determinate width, label, and step count", () => {
  render(<ProgressBar progress={{ step: 3, total: 12, label: "Option 1: image generated" }} />);
  expect(screen.getByText("Option 1: image generated · 3 of 12")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/__tests__/ProgressBar.test.tsx`
Expected: FAIL — cannot resolve `../components/ProgressBar`.

- [ ] **Step 3: Implement the component**

Create `frontend/src/components/ProgressBar.tsx`:

```tsx
import type { StreamProgress } from "../types";

/** Loading bar: determinate (real step/total from a streaming endpoint) when
 *  `progress` is given, otherwise an animated indeterminate bar. */
export function ProgressBar({ progress }: { progress?: StreamProgress | null }) {
  const pct = progress ? Math.round((100 * progress.step) / Math.max(1, progress.total)) : null;
  return (
    <div className="pbar-wrap" role="status">
      <div className="pbar">
        {pct === null
          ? <div className="pbar-fill indet" />
          : <div className="pbar-fill" style={{ width: `${pct}%` }} />}
      </div>
      <div className="pbar-lbl">
        {progress ? `${progress.label} · ${progress.step} of ${progress.total}` : "Loading…"}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Upgrade AsyncSection**

Replace `frontend/src/components/AsyncSection.tsx` with:

```tsx
import type { ReactNode } from "react";
import type { Query } from "../hooks/useApi";
import type { StreamProgress } from "../types";
import { ProgressBar } from "./ProgressBar";

/** Wraps one data section: independent loading / error+retry / success states.
 *  Pass `progress` (from a streaming call) to upgrade the loading bar to determinate. */
export function AsyncSection<T>({ q, progress, children }: {
  q: Query<T>; progress?: StreamProgress | null; children: (data: T) => ReactNode;
}) {
  if (q.loading) return <ProgressBar progress={progress} />;
  if (q.error !== undefined) {
    return (
      <div className="async-note err">
        Couldn't load this section ({q.error}).
        <button className="btn btn-outline btn-sm" onClick={q.reload}>Retry</button>
      </div>
    );
  }
  return <>{children(q.data as T)}</>;
}
```

- [ ] **Step 5: Add the CSS**

In `frontend/src/styles/theme.css`, add after the `.btn-underline` rule (line ~71):

```css
.btn:disabled{opacity:.45;cursor:not-allowed;transform:none}
```

And after the `.async-note .btn` rule (line ~279):

```css
.pbar-wrap{padding:14px 18px}
.pbar{height:6px;border-radius:99px;background:var(--border);overflow:hidden}
.pbar-fill{height:100%;border-radius:99px;background:var(--ora);transition:width .3s ease}
.pbar-fill.indet{width:35%;animation:pbar-slide 1.1s ease-in-out infinite}
@keyframes pbar-slide{from{margin-left:-35%}to{margin-left:100%}}
.pbar-lbl{font-size:11.5px;color:var(--muted);margin-top:7px;text-align:center}
```

- [ ] **Step 6: Run the full frontend suite**

Run: `npx vitest run`
Expected: PASS — including every existing test that asserted the "Loading…" text (the indeterminate bar keeps that label).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/ProgressBar.tsx frontend/src/components/AsyncSection.tsx frontend/src/__tests__/ProgressBar.test.tsx frontend/src/styles/theme.css
git commit -m "feat(dashboard): progress bars (determinate + indeterminate loading states)"
```

---

### Task 10: Research selector fixes + refresh cache-bust

**Files:**
- Modify: `frontend/src/views/research/ResearchView.tsx`
- Test: `frontend/src/__tests__/ResearchView.test.tsx`

- [ ] **Step 1: Rewrite the failing tests**

Replace the first two tests in `frontend/src/__tests__/ResearchView.test.tsx` with (keep the third "round-trip" test unchanged):

```tsx
test("clear all selects none and disables View Research", async () => {
  vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {}))); // tabs stay loading — fine
  render(<ToastProvider><ResearchView onGenerate={() => {}} /></ToastProvider>);
  expect(screen.getByText("4 of 4 sources selected")).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: /clear all/i }));
  expect(screen.getByText("0 of 4 sources selected")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /view research/i })).toBeDisabled();

  // re-enable one source and enter tabs: only that sub-tab shows
  await userEvent.click(screen.getByText("Customer Chats"));
  await userEvent.click(screen.getByRole("button", { name: /view research/i }));
  expect(screen.getByRole("button", { name: "Customer Chats" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Internet Trends" })).toBeNull();
});

test("every source can be deselected — no forced minimum", async () => {
  vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
  render(<ToastProvider><ResearchView onGenerate={() => {}} /></ToastProvider>);
  for (const label of ["Internet Trends", "Customer Chats", "Social Media", "Competitor Analysis"])
    await userEvent.click(screen.getByText(label));
  expect(screen.getByText("0 of 4 sources selected")).toBeInTheDocument();
  expect(screen.queryByText("At least one source must stay selected")).toBeNull();
});
```

- [ ] **Step 2: Run to verify the new tests fail**

Run: `npx vitest run src/__tests__/ResearchView.test.tsx`
Expected: FAIL — "1 of 4 sources selected" still shows after Clear all; the minimum-guard toast still appears.

- [ ] **Step 3: Fix ResearchView**

In `frontend/src/views/research/ResearchView.tsx`:

1. Remove the toast import and hook (both now unused): delete `import { useToast } from "../../toast";` and `const toast = useToast();`.
2. Add the cache import: `import { cacheDelete } from "../../lib/cache";`
3. Add the tab→cache-key map below the `TOPICS` array:

```tsx
/** AI cache key busted by the header Refresh (lib/cache.ts keys, see the spec §3). */
const TAB_CACHE_KEY: Record<TopicId, string> = {
  tr: "internet-trends", zo: "customer-insights", so: "social-reviews", cp: "competitor",
};
```

4. Replace the `toggle` function with:

```tsx
  const toggle = (id: TopicId) => setEnabled({ ...enabled, [id]: !enabled[id] });
```

5. Replace the Clear all button's onClick:

```tsx
            <button className="btn-underline" onClick={() => setEnabled({ tr: false, zo: false, so: false, cp: false })}>
              Clear all
            </button>
```

6. Disable View Research at zero:

```tsx
          <button className="btn btn-ora" onClick={openTabs} disabled={count === 0}>
            <Ico k="check" /> View Research
          </button>
```

7. Make the header Refresh bust the active tab's AI cache before remounting:

```tsx
          <button className="btn btn-white"
            onClick={() => { cacheDelete(TAB_CACHE_KEY[active]); setRefreshKey((k) => k + 1); }}>
            <Ico k="refresh" /> Refresh
          </button>
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/__tests__/ResearchView.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/research/ResearchView.tsx frontend/src/__tests__/ResearchView.test.tsx
git commit -m "fix(dashboard): clear-all selects none; View Research disabled at zero"
```

---

### Task 11: Modes context + StatusBadge + AiCard integration

**Files:**
- Create: `frontend/src/modes.tsx`, `frontend/src/components/StatusBadge.tsx`
- Modify: `frontend/src/components/AiCard.tsx`, `frontend/src/components/SuggestedPosts.tsx`, `frontend/src/App.tsx`, `frontend/src/styles/theme.css`
- Test: Create `frontend/src/__tests__/StatusBadge.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/__tests__/StatusBadge.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { StatusBadge } from "../components/StatusBadge";
import { ModesProvider } from "../modes";

afterEach(() => vi.restoreAllMocks());

const MODES = {
  sources: { meta: "fixture", google_reviews: "fixture", google_ads: "live", zoho: "live" },
  ai: { llm: "fake", image: "fake", canva: "fake" },
};

const ok = (body: unknown) => ({ ok: true, status: 200, statusText: "OK", json: async () => body });

test("renders data and AI badges from /config/modes", async () => {
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(ok(MODES))));
  render(
    <ModesProvider>
      <StatusBadge kind="data" source="google_ads" />
      <StatusBadge kind="data" source="meta" />
      <StatusBadge kind="ai" />
    </ModesProvider>,
  );
  expect(await screen.findByText("Live")).toBeInTheDocument();
  expect(screen.getByText("Fixture")).toBeInTheDocument();
  expect(screen.getByText("Sample AI")).toBeInTheDocument();
});

test("renders nothing when the modes fetch fails", async () => {
  vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("down"))));
  const { container } = render(
    <ModesProvider><StatusBadge kind="data" source="meta" /></ModesProvider>,
  );
  // give the rejected fetch a tick to settle
  await new Promise((r) => setTimeout(r, 0));
  expect(container.querySelector(".stat-badge")).toBeNull();
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/__tests__/StatusBadge.test.tsx`
Expected: FAIL — cannot resolve `../components/StatusBadge` / `../modes`.

- [ ] **Step 3: Implement the modes context**

Create `frontend/src/modes.tsx`:

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api";
import type { Modes } from "./types";

const ModesCtx = createContext<Modes | undefined>(undefined);

/** Fetches /config/modes once per app load (in-memory only — must reflect env
 *  changes on reload). On failure modes stay undefined and StatusBadge renders
 *  nothing, so no view ever breaks on this call. */
export function ModesProvider({ children }: { children: ReactNode }) {
  const [modes, setModes] = useState<Modes | undefined>(undefined);
  useEffect(() => { api.modes().then(setModes, () => undefined); }, []);
  return <ModesCtx.Provider value={modes}>{children}</ModesCtx.Provider>;
}

export const useModes = () => useContext(ModesCtx);
```

- [ ] **Step 4: Implement StatusBadge**

Create `frontend/src/components/StatusBadge.tsx`:

```tsx
import { useModes } from "../modes";
import type { Modes } from "../types";

/** Live/Fixture dot + text (spec §4). kind="data" reads sources[source];
 *  kind="ai" reads ai.llm. Renders nothing until modes are known. `light` is
 *  for colored headers. */
export function StatusBadge({ kind, source, light }: {
  kind: "data" | "ai"; source?: keyof Modes["sources"]; light?: boolean;
}) {
  const modes = useModes();
  if (!modes || (kind === "data" && !source)) return null;
  const live = kind === "ai" ? modes.ai.llm === "live" : modes.sources[source!] === "live";
  const text = kind === "ai" ? (live ? "Live AI" : "Sample AI") : (live ? "Live" : "Fixture");
  return (
    <span className={`stat-badge${light ? " light" : ""}`}>
      <span className="stat-dot" style={{ background: live ? "var(--green)" : "var(--gold)" }} />
      {text}
    </span>
  );
}
```

Add to `frontend/src/styles/theme.css` (below the `.pbar-lbl` rule from Task 9):

```css
.stat-badge{display:inline-flex;align-items:center;gap:5px;font-size:10.5px;font-weight:700;color:var(--muted);white-space:nowrap;vertical-align:middle;margin-left:8px}
.stat-badge.light{color:#ffffffd9}
.stat-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
```

- [ ] **Step 5: Bake the AI badge into AiCard; add an action slot**

Replace `frontend/src/components/AiCard.tsx` with:

```tsx
import type { CSSProperties, ReactNode } from "react";
import { Ico } from "../icons";
import { StatusBadge } from "./StatusBadge";
import { TagPill } from "./TagPill";

/** Ports the prototype's `.ai-card` header pattern — see docs/draft/urbanspace_dashboard.html lines 674-681.
 *  Every AiCard is AI-generated content, so the header always carries the AI mode badge.
 *  `action` renders right of the tag (e.g. a refresh button). */
export function AiCard({ title, sub, tag, style, action, children }: {
  title: string; sub?: string; tag?: string; style?: CSSProperties;
  action?: ReactNode; children: ReactNode;
}) {
  return (
    <div className="ai-card" style={style}>
      <div className="ai-card-hdr">
        <div className="ai-card-title-row">
          <div className="ai-star-ico"><Ico k="sparkle" /></div>
          <div className="card-title" style={{ fontSize: 17 }}>{title}</div>
          <StatusBadge kind="ai" />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {tag && <TagPill red>{tag}</TagPill>}
          {action}
        </div>
      </div>
      {sub && <div className="card-sub" style={{ marginBottom: 6 }}>{sub}</div>}
      {children}
    </div>
  );
}
```

- [ ] **Step 6: Add the optional refresh slot to SuggestedPosts**

Replace `frontend/src/components/SuggestedPosts.tsx` with:

```tsx
import { Ico } from "../icons";
import { AiCard } from "./AiCard";

/** Ports the prototype's suggBlock — see docs/draft/urbanspace_dashboard.html lines 665-682.
 *  `titles` come from the backend's research/recommendation `titles` arrays.
 *  `onRefresh` (optional) renders a refresh button that busts the caller's cache. */
export function SuggestedPosts({ title, sub, titles, subLabel, onGenerate, onRefresh }: {
  title: string; sub: string; titles: string[]; subLabel: string;
  onGenerate: (title: string) => void; onRefresh?: () => void;
}) {
  return (
    <AiCard title={title} sub={sub} tag="AI SUGGESTED POSTS"
      action={onRefresh
        ? <button className="btn btn-white btn-sm" onClick={onRefresh} aria-label="Refresh">
            <Ico k="refresh" />
          </button>
        : undefined}>
      {titles.map((t, i) => (
        <div className="sugg-row" key={i}>
          <div className="sugg-num">{i + 1}</div>
          <div style={{ flex: 1 }}>
            <div className="sugg-title">{t}</div>
            <div className="sugg-sub">{subLabel}</div>
          </div>
          <button className="btn btn-ai btn-sm" onClick={() => onGenerate(t)}>
            <Ico k="pencil" /> Generate
          </button>
        </div>
      ))}
    </AiCard>
  );
}
```

- [ ] **Step 7: Mount the provider in App**

In `frontend/src/App.tsx`: add `import { ModesProvider } from "./modes";` and wrap the shell:

```tsx
  return (
    <ToastProvider>
      <ModesProvider>
        <div className="shell">
          …existing content unchanged…
        </div>
      </ModesProvider>
    </ToastProvider>
  );
```

- [ ] **Step 8: Run the full frontend suite**

Run: `npx vitest run`
Expected: PASS — existing view tests render badges as `null` (no ModesProvider / pending fetch), so nothing breaks.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/modes.tsx frontend/src/components/StatusBadge.tsx frontend/src/__tests__/StatusBadge.test.tsx frontend/src/components/AiCard.tsx frontend/src/components/SuggestedPosts.tsx frontend/src/App.tsx frontend/src/styles/theme.css
git commit -m "feat(dashboard): live/fixture status badges + modes context"
```

---

### Task 12: Wire cache + badges into Home and the research tabs

**Files:**
- Modify: `frontend/src/views/HomeView.tsx`
- Modify: `frontend/src/views/research/TrendsTab.tsx`, `CustomerTab.tsx`, `SocialTab.tsx`, `CompetitorTab.tsx`

No new tests: the caching behavior is covered by Task 7's hook tests, badges by Task 11's; this task is wiring. The regression gate is the existing suite staying green.

- [ ] **Step 1: HomeView — cached engagement + refresh + badges**

In `frontend/src/views/HomeView.tsx`:

1. Extend imports:

```tsx
import { useApi, useCachedApi } from "../hooks/useApi";
import { StatusBadge } from "../components/StatusBadge";
```

2. Switch the engagement query (line ~65):

```tsx
  const engagement = useCachedApi("weekly-engagement", api.weeklyEngagement);
```

3. KPI card title gains a data badge — replace `<div className="card-title">KPI</div>` with:

```tsx
<div className="card-title">KPI <StatusBadge kind="data" source="meta" /></div>
```

4. AI Weekly Summary header gains an AI badge + refresh button — replace the `.ai-card-hdr` block with:

```tsx
          <div className="ai-card-hdr">
            <div className="ai-card-title-row">
              <div className="ai-star-ico"><Ico k="sparkle" /></div>
              <div>
                <div className="card-title">AI Weekly Summary <StatusBadge kind="ai" /></div>
                <div className="card-sub">Auto-generated from this week's performance data</div>
              </div>
            </div>
            <button className="btn btn-white btn-sm" onClick={engagement.reload} aria-label="Refresh AI summary">
              <Ico k="refresh" />
            </button>
          </div>
```

- [ ] **Step 2: TrendsTab — cached trends + google_ads badges**

In `frontend/src/views/research/TrendsTab.tsx`:

1. Imports: `import { useApi, useCachedApi } from "../../hooks/useApi";` and `import { StatusBadge } from "../../components/StatusBadge";`
2. `const trends = useCachedApi("internet-trends", api.internetTrends);` (history stays on `useApi` — cheap data read).
3. Both section titles gain the badge:

```tsx
<div className="ct-title">Weekly Search Volume in Singapore <StatusBadge kind="data" source="google_ads" /></div>
```

```tsx
<div className="ct-title">Keyword ranking <StatusBadge kind="data" source="google_ads" /></div>
```

- [ ] **Step 3: CustomerTab — cached insights + zoho/AI badges**

In `frontend/src/views/research/CustomerTab.tsx`:

1. Imports: `import { useApi, useCachedApi } from "../../hooks/useApi";` and `import { StatusBadge } from "../../components/StatusBadge";`
2. `const insights = useCachedApi("customer-insights", api.customerInsights);` (questions + chats stay on `useApi`).
3. Banner: after `<b>About this data</b>` insert the badge:

```tsx
          <b>About this data</b> <StatusBadge kind="data" source="zoho" /><br />
```

4. Questions card title (inside the `.gold-card` `ct-title-row`):

```tsx
              <div className="ct-title" style={{ color: "#4A3200" }}>Common questions before booking <StatusBadge kind="data" source="zoho" /></div>
```

5. Service Analysis (AI-derived ranking on the dark card):

```tsx
              <div className="ct-title" style={{ color: "#fff" }}>Service Analysis <StatusBadge kind="ai" light /></div>
```

(The "AI Insights & Patterns" AiCard and SuggestedPosts get their badges automatically from Task 11.)

- [ ] **Step 4: SocialTab — cached social + meta/google_reviews badges**

In `frontend/src/views/research/SocialTab.tsx`:

1. Imports: `import { useApi, useCachedApi } from "../../hooks/useApi";` and `import { StatusBadge } from "../../components/StatusBadge";`
2. `const social = useCachedApi("social-reviews", api.socialReviews);` (posts/comments/reviews stay on `useApi`).
3. Engagement section title:

```tsx
      <div className="ct-title" style={{ marginBottom: 2 }}>Engagement <StatusBadge kind="data" source="meta" /></div>
```

4. Both platform card headers (`.soc-hdr`) gain a light badge after the `<small>`:

```tsx
            <span>Facebook</span><small>{posts.data ? `${fb.length} posts` : "…"}</small><StatusBadge kind="data" source="meta" light />
```

```tsx
            <span>Instagram</span><small>{posts.data ? `${ig.length} posts` : "…"}</small><StatusBadge kind="data" source="meta" light />
```

5. Comments card header:

```tsx
            <span>Post comments</span><small>{comments.data?.count ?? "…"} total</small><StatusBadge kind="data" source="meta" light />
```

6. Google reviews card header (inside the render function):

```tsx
                    <span>Google</span><small>{avg ? `★${avg} · ${r.items.length}` : `${r.count} reviews`}</small><StatusBadge kind="data" source="google_reviews" light />
```

- [ ] **Step 5: CompetitorTab — cached analysis + meta badge**

In `frontend/src/views/research/CompetitorTab.tsx`:

1. Imports: `import { useApi, useCachedApi } from "../../hooks/useApi";` and `import { StatusBadge } from "../../components/StatusBadge";`
2. `const analysis = useCachedApi("competitor", api.competitor);` (competitors/posts stay on `useApi`).
3. Section title:

```tsx
      <div className="ct-title" style={{ marginBottom: 2 }}>Your Competitors <StatusBadge kind="data" source="meta" /></div>
```

- [ ] **Step 6: Run the full frontend suite**

Run: `npx vitest run`
Expected: PASS — all existing view tests still pass (cache misses on a clean localStorage behave exactly like `useApi`).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/views/HomeView.tsx frontend/src/views/research/TrendsTab.tsx frontend/src/views/research/CustomerTab.tsx frontend/src/views/research/SocialTab.tsx frontend/src/views/research/CompetitorTab.tsx
git commit -m "feat(dashboard): wire AI cache + live/fixture badges into Home and research tabs"
```

---

### Task 13: GenerateView — streaming generate, cached+streamed recommendations, square images

**Files:**
- Modify: `frontend/src/views/GenerateView.tsx`, `frontend/src/styles/theme.css`
- Test: `frontend/src/__tests__/GenerateView.test.tsx` (rewrite the fetch stub + add tests)

- [ ] **Step 1: Rewrite the test fetch stub and update assertions (failing first)**

In `frontend/src/__tests__/GenerateView.test.tsx`, replace the `ok` helper and `stubFetch` with:

```tsx
const ok = (body: unknown) => ({ ok: true, status: 200, statusText: "OK", json: async () => body });

/** Streaming endpoints return NDJSON over a ReadableStream body (see lib/stream.ts). */
const ndjson = (events: unknown[]) => ({
  ok: true, status: 200, statusText: "OK",
  body: new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder();
      for (const e of events) controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));
      controller.close();
    },
  }),
});

const POST_OPTION = {
  caption: "Real AI caption", hashtags: ["#UrbanSpaceSG"], image_b64: "aGk=",
  mime_type: "image/png", canva_edit_url: "https://canva.example/edit/1",
  visual_style: "clean_product",
};

function stubFetch(overrides: Record<string, unknown> = {}) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  vi.stubGlobal("fetch", vi.fn((url: string, init?: RequestInit) => {
    calls.push({ url, init });
    if (url.startsWith("/generate/post/stream"))
      return Promise.resolve(ndjson([
        { event: "progress", step: 0, total: 12, label: "Starting…" },
        { event: "result", data: overrides["/generate/post/stream"] ?? { options: [POST_OPTION] } },
      ]));
    if (url.startsWith("/generate/recommendations/stream"))
      return Promise.resolve(ndjson([
        { event: "progress", step: 0, total: 5, label: "Starting…" },
        { event: "result", data: { titles: ["3 months free"], prefill_prompt: "Reco context",
                                    rationale: "Promo interest is highest." } },
      ]));
    if (url.startsWith("/generate/drafts") && init?.method === "POST")
      return Promise.resolve(ok({ id: 8, platform: "instagram", caption: "new", image_b64: "",
        canva_edit_url: "", created_at: "2026-07-13T00:00:00Z" }));
    if (url.startsWith("/generate/drafts") && init?.method === "PATCH")
      return Promise.resolve(ok({ id: 7, platform: "instagram", caption: "Edited caption", image_b64: "",
        canva_edit_url: "", created_at: "2026-07-10T00:00:00Z" }));
    if (url.startsWith("/generate/drafts") && init?.method === "DELETE")
      return Promise.resolve({ ok: true, status: 204, statusText: "No Content" });
    if (url.startsWith("/generate/drafts"))
      return Promise.resolve(ok({ items: [
        { id: 7, platform: "instagram", caption: "Saved caption", image_b64: "",
          canva_edit_url: "", created_at: "2026-07-10T00:00:00Z" },
      ], count: 1 }));
    return Promise.reject(new Error(`unexpected ${url}`));
  }));
  return calls;
}
```

Then in the first test, update the request-body assertion's URL:

```tsx
  const gen = calls.find((c) => c.url === "/generate/post/stream")!;
```

And append two new tests at the end of the file:

```tsx
test("generated image renders in a square card header", async () => {
  stubFetch();
  render(<ToastProvider><GenerateView request={null} /></ToastProvider>);
  await userEvent.click(screen.getByRole("button", { name: /generate 3 options/i }));
  const img = await screen.findByAltText("Draft 1 visual");
  expect(img.closest(".gdraft-hdr")!.className).toContain("has-img");
});

test("recommendations served from cache on remount — no refetch", async () => {
  stubFetch();
  const first = render(<ToastProvider><GenerateView request={null} /></ToastProvider>);
  expect(await screen.findByText("3 months free")).toBeInTheDocument();
  first.unmount();

  const calls = stubFetch(); // fresh mock: any recommendations call would be recorded here
  render(<ToastProvider><GenerateView request={null} /></ToastProvider>);
  expect(await screen.findByText("3 months free")).toBeInTheDocument();
  expect(calls.some((c) => c.url.startsWith("/generate/recommendations"))).toBe(false);
});
```

- [ ] **Step 2: Run to verify the suite fails**

Run: `npx vitest run src/__tests__/GenerateView.test.tsx`
Expected: FAIL — the view still calls `/generate/post` and `/generate/recommendations` (rejected as `unexpected`), and no `has-img` class exists.

- [ ] **Step 3: Update GenerateView**

In `frontend/src/views/GenerateView.tsx`:

1. Imports — replace the hooks/components import lines with:

```tsx
import { ProgressBar } from "../components/ProgressBar";
import { StatusBadge } from "../components/StatusBadge";
import { useApi, useCachedApi } from "../hooks/useApi";
import { useModes } from "../modes";
import type { GenRequest, PostOption, StreamProgress } from "../types";
```

(keep the existing `api`, `AsyncSection`, `SuggestedPosts`, `TagPill`, `Ico`, `downloadPostPNG`, `useToast` imports.)

2. State — replace `const recos = useApi(api.recommendations);` and add progress state near the other `useState` calls:

```tsx
  const drafts = useApi(api.listDrafts);
  const [recoProgress, setRecoProgress] = useState<StreamProgress | null>(null);
  const recos = useCachedApi("recommendations", () => api.recommendationsStream(setRecoProgress));
  const modes = useModes();
```

```tsx
  const [genProgress, setGenProgress] = useState<StreamProgress | null>(null);
```

3. `doGenerate` — switch to the streaming call:

```tsx
  const doGenerate = async () => {
    setBusy(true);
    setGenProgress(null);
    try {
      const prefill = [context, prompt.trim(), `Target audience: ${audience}`]
        .filter(Boolean).join("\n\n");
      const res = await api.generatePostStream({
        platform: platform.toLowerCase(), tone: tone.toLowerCase(), length: length.toLowerCase(),
        prefill_prompt: prefill, visual_style: style,
        include_hashtags: flags.hashtags, include_cta: flags.cta,
        include_emoji: flags.emoji, include_pricing: flags.pricing, options: 3,
      }, setGenProgress);
      setGenResult({ platform, options: res.options });
      toast(`Generated ${res.options.length} options`);
    } catch (e) {
      toast(`Generation failed: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(false);
      setGenProgress(null);
    }
  };
```

4. Below the Generate button, show the live progress while busy:

```tsx
        <button className="btn btn-blue" onClick={doGenerate} disabled={busy}>
          <Ico k="sparkle" /> {busy ? "Generating…" : "Generate 3 options"}
        </button>
        {busy && <ProgressBar progress={genProgress} />}
```

5. "Generated options" header gains the AI badge + sample-images pill:

```tsx
              <div className="card-title" style={{ fontSize: 19 }}>
                Generated options <StatusBadge kind="ai" />
                {modes && modes.ai.image !== "live" && (
                  <TagPill style={{ background: "var(--gold-l)", color: "var(--gold-d)", marginLeft: 8 }}>
                    Sample images
                  </TagPill>
                )}
              </div>
```

6. Square image headers — change the option card header div to:

```tsx
                <div className={`gdraft-hdr${o.image_b64 ? " has-img" : ""}`}
                  style={{ background: platformColor(genResult.platform), padding: 0 }}>
```

7. Recommendations section — pass progress through and wire the refresh:

```tsx
      <AsyncSection q={recos} progress={recoProgress}>
        {(r) => (
          <SuggestedPosts title="AI Recommendations — one-click prefill"
            sub={r.rationale} titles={r.titles} subLabel="From this week's research"
            onGenerate={(title) => { setPrompt(title); setContext(r.prefill_prompt); }}
            onRefresh={recos.reload} />
        )}
      </AsyncSection>
```

8. Add the square-image CSS in `frontend/src/styles/theme.css`, directly below the `.gdraft-hdr` rule (line ~256):

```css
.gdraft-hdr.has-img{aspect-ratio:1/1;height:auto}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/__tests__/GenerateView.test.tsx`
Expected: PASS (7 tests).

- [ ] **Step 5: Run the whole frontend suite + build**

Run: `npx vitest run && npm run build`
Expected: all tests pass; the production build (type check included) succeeds.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/views/GenerateView.tsx frontend/src/__tests__/GenerateView.test.tsx frontend/src/styles/theme.css
git commit -m "feat(dashboard): streaming generation progress, cached recommendations, square image cards"
```

---

### Task 14: UrbanSpace rename sweep

**Files:**
- Modify: `frontend/index.html`, `frontend/src/views/HomeView.tsx`, `frontend/src/views/research/ResearchView.tsx`, `frontend/src/views/GenerateView.tsx`, `frontend/src/views/research/CustomerTab.tsx`, `frontend/src/__tests__/App.test.tsx`, `tests/api/test_static_dashboard.py`

- [ ] **Step 1: Update the test expectations first**

In `frontend/src/__tests__/App.test.tsx`: change the assertion to `expect(screen.getByText(/Hello, UrbanSpace team/)).toBeInTheDocument();`

In `tests/api/test_static_dashboard.py`: change the fixture HTML to `"<!doctype html><title>UrbanSpace</title>"` and the assertion to `assert "UrbanSpace" in res.text`.

- [ ] **Step 2: Run both to verify they fail**

Run: `npx vitest run src/__tests__/App.test.tsx` (from `frontend/`) and `uv run pytest tests/api/test_static_dashboard.py -q` (from the repo root)
Expected: the App test FAILS ("Urban Space" still rendered); the backend test PASSES (it writes its own fixture) — it was updated for consistency, not behavior.

- [ ] **Step 3: Apply the copy changes ("Urban Space" → "UrbanSpace" in each)**

- `frontend/index.html`: `<title>UrbanSpace — Marketing Agent</title>`
- `frontend/src/views/HomeView.tsx` (3): "Hello, UrbanSpace team.", "Marketing overview for UrbanSpace Self Storage - this week.", "…posts with AI in UrbanSpace brand voice."
- `frontend/src/views/research/ResearchView.tsx` (2): "AI-powered market intelligence for UrbanSpace — updated weekly."
- `frontend/src/views/GenerateView.tsx` (1): "Create a post — AI writes it in UrbanSpace's brand voice."
- `frontend/src/views/research/CustomerTab.tsx` (1): "Analysed from UrbanSpace's customer chats linked via ZOHO CRM."

- [ ] **Step 4: Verify no stragglers**

Run from the repo root:

```bash
grep -rn "Urban Space" frontend/src frontend/index.html src tests
```

Expected: no output (`docs/draft/` is the archive and is deliberately excluded from the search paths).

- [ ] **Step 5: Run both suites**

Run: `uv run pytest tests/api/test_static_dashboard.py -q` and `npx vitest run` (from `frontend/`)
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/index.html frontend/src tests/api/test_static_dashboard.py
git commit -m "chore: brand name Urban Space -> UrbanSpace in dashboard copy"
```

---

### Task 15: README rewrite + deploy doc touches

**Files:**
- Modify: `README.md` (full rewrite of the top; keep the existing endpoint tables where noted), `deploy/README.md`

- [ ] **Step 1: Rewrite README.md**

Replace everything from the top of `README.md` **down to (but not including) the existing "## Data & Ingestion API" section** with:

```markdown
# Athena — AI Marketing Pipeline for UrbanSpace

Backend + dashboard that ingests UrbanSpace's marketing data (Meta posts/comments,
Google Business reviews, Google Ads keyword volumes, Zoho CRM chat transcripts), runs
AI research and content generation over it (Claude for text, Gemini for images, Canva
for editing handoff), and serves the results as a marketing dashboard.
Python + FastAPI + LangGraph + Postgres; React dashboard.

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

- **Home** — weekly KPI tiles (views, likes, interactions, posts) and an AI Weekly
  Summary of your top post's comments.
- **Research** — choose your sources, then four tabs: **Internet Trends** (keyword
  search volumes), **Customer Chats** (questions customers ask + AI insights from Zoho
  chats), **Social Media** (post performance, comments, Google reviews), **Competitor
  Analysis** (tracked competitors' activity + AI strategy). Every AI section offers
  suggested post titles you can send to Generate with one click.
- **Generate** — brief the AI (platform, tone, length, audience, visual style) and get
  3 post options with captions and images; download as PNG, save to drafts, or open in
  Canva. AI Recommendations synthesize all research sources into ready-to-use ideas.
- **Settings** — manage tracked competitors, keywords, and the AI agents' prompts.

**Live vs Fixture badges.** Each section carries a dot: green **Live** means real data
from the connected service; amber **Fixture** means built-in sample data (shaped like
the real thing — used for demos and while credentials are pending). AI sections show
**Live AI** (Claude) or **Sample AI** (deterministic placeholder). Which services are
live is server configuration — ask your developer.

**Freshness & progress.** AI answers are cached in your browser for 24 hours so repeat
visits are instant and don't re-spend AI credits. Use the ↻ refresh buttons (Research
header, AI Weekly Summary, AI Recommendations) to force fresh analysis. Long AI jobs —
generating posts, building recommendations — show a real progress bar with step labels.

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

To serve the dashboard from the API instead, build it once: `cd frontend && npm run build`
(served at `/` when `frontend/dist` exists; disable with `SERVE_FRONTEND=false`).

### Tests & lint

```bash
uv run pytest            # backend (needs Docker for testcontainers)
uv run ruff check .
cd frontend && npx vitest run
```

### Configuration

Everything is env-driven via `.env` — see `.env.example` (grouped and commented).
Highlights:

| Env | Meaning |
|---|---|
| `DATABASE_URL` | Postgres URL; `DB_AUTO_CREATE=true` (default) creates + migrates on startup |
| `SOURCE_MODE` + `META_/GOOGLE_REVIEWS_/GOOGLE_ADS_/ZOHO_SOURCE_MODE` | `fixture` \| `live` per data source |
| `LLM_MODE` + `CLAUDE_API_KEY` | `fake` \| `live` text AI (Claude, default `claude-sonnet-5`) |
| `IMAGE_MODE` + `GEMINI_API_KEY` | `fake` \| `live` image AI (Gemini) |
| `CANVA_MODE` + Canva tokens | `fake` \| `live` Canva Connect handoff |
| `FRONTEND_DIST`, `SERVE_FRONTEND` | Where the built dashboard lives; whether to serve it at `/` |

The effective modes are exposed at `GET /config/modes` (no secrets) and drive the
dashboard's Live/Fixture badges.
```

Then, keeping the existing endpoint tables ("Data & Ingestion API", "Home API", "Research API", and the generate/config sections) as subsections under "For developers", make these updates inside them:

1. In the generate endpoints table, add rows:

```markdown
| POST | /generate/post/stream | Streaming variant of /generate/post — NDJSON progress events, then a result event |
| GET | /generate/recommendations/stream | Streaming variant of /generate/recommendations — 4 analyst events + synthesis, then result |
```

2. Below the generate table, add the stream contract:

```markdown
Streaming endpoints emit `application/x-ndjson`, one JSON object per line:
`{"event":"progress","step":n,"total":N,"label":"Option 2: image generated"}` per
completed step, then `{"event":"result","data":…}` (same shape as the sync endpoint),
or `{"event":"error","detail":"…"}` on failure (nothing is persisted on failure).
```

3. In the config endpoints section, add:

```markdown
| GET | /config/modes | Effective live/fixture mode per data source + AI client (drives the dashboard badges) |
```

4. Anywhere the old README says "Urban Space", write "UrbanSpace".

- [ ] **Step 2: deploy/README.md touches**

In `deploy/README.md`:
- In the "Fill in the environment" bullet list, add: ``- **`SERVE_FRONTEND`** *(optional)* — default `true`; set `false` to serve the API only (no dashboard at `/`).``
- In the "Reach the services" table, change the `api` row's "Serves" cell to: ``REST API (`/docs`, `/openapi.json`) **and** the bundled marketing dashboard at `/` (disable with `SERVE_FRONTEND=false`)``

- [ ] **Step 3: Sanity-check the docs**

Run from the repo root:

```bash
grep -n "SERVE_FRONTEND" README.md .env.example deploy/README.md deploy/docker-compose.yml
grep -n "post/stream\|recommendations/stream\|config/modes" README.md
```

Expected: hits in all listed files.

- [ ] **Step 4: Commit**

```bash
git add README.md deploy/README.md
git commit -m "docs: README rewrite for marketing + developer audiences; deploy notes"
```

---

### Task 16: Full verification

- [ ] **Step 1: Backend suite + lint**

Run from the repo root: `uv run pytest -q && uv run ruff check .`
Expected: all tests pass (baseline was 164 + new ones), ruff clean.

- [ ] **Step 2: Frontend suite + production build**

Run from `frontend/`: `npx vitest run && npm run build`
Expected: all tests pass; build succeeds (type check included).

- [ ] **Step 3: Fix anything that surfaced, commit fixes**

If both gates are green with nothing to fix, no commit is needed. Otherwise commit fixups as `fix: <what>`.

- [ ] **Step 4: Confirm branch state**

Run: `git log --oneline main..feature/dashboard-polish`
Expected: the spec commit + one commit per task above. The branch is ready for review/merge (use superpowers:finishing-a-development-branch).
