# Native Claude + Gemini APIs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace OpenRouter with native Anthropic Claude Sonnet (text) and Google Gemini Flash image generation, and fix two `/research` behaviors — scope `/research/internet-trends` to the latest window with server-side dedupe, and require a non-empty `CompetitorIn.name`.

**Architecture:** The AI layer keeps its `fake | live` split and the `LLMClient` / `ImageClient` protocols. `OpenRouterLLM` → `AnthropicLLM` (langchain-anthropic, `ChatAnthropic.with_structured_output`, thinking disabled). `OpenRouterImageClient` → `GeminiImageClient` (native Gemini `generateContent` via `httpx`). Config swaps OpenRouter env fields for Claude/Gemini ones. Callers (`deps.py`, `features/research.py`, `features/aggregate.py`, generate routes) are unchanged.

**Tech Stack:** Python 3.13 (uv-managed venv), FastAPI, SQLAlchemy 2, LangGraph/LangChain, `langchain-anthropic`, `httpx`, pytest + testcontainers[postgres].

**Spec:** `docs/specs/2026-07-14-native-claude-gemini-apis-design.md`

**Environment notes:**
- Run everything through uv: `uv run pytest ...`, `uv run python ...`.
- Tests that use the `session` fixture spin up a Postgres **testcontainer**, which needs Docker. This repo reaches Docker through a **WSL loopback socat bridge + `DOCKER_HOST`** — make sure that bridge is up before running DB-backed tests (Tasks 2, and the full-suite run). The config/llm/images unit tests do **not** need Docker.
- Work happens on branch `feat/native-claude-gemini-apis` (already created and checked out).

---

### Task 1: Require a non-empty `CompetitorIn.name`

**Files:**
- Modify: `src/athena/api/schemas.py` (class `CompetitorIn`, ~line 212)
- Test: `tests/api/test_config_routes.py` *(see Step 1 note — put the test wherever CompetitorIn is already exercised; if unsure, create `tests/api/test_competitor_schema.py`)*

- [ ] **Step 1: Write the failing test**

Create `tests/api/test_competitor_schema.py`:

```python
import pytest
from pydantic import ValidationError
from athena.api.schemas import CompetitorIn


def test_competitor_in_accepts_valid_name():
    c = CompetitorIn(platform="facebook", name="UrbanCo")
    assert c.name == "UrbanCo"


def test_competitor_in_rejects_empty_name():
    with pytest.raises(ValidationError):
        CompetitorIn(platform="facebook", name="")
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `uv run pytest tests/api/test_competitor_schema.py -v`
Expected: `test_competitor_in_rejects_empty_name` FAILS (an empty name is currently accepted, so no `ValidationError` is raised).

- [ ] **Step 3: Add `min_length=1`**

In `src/athena/api/schemas.py`, change `CompetitorIn`:

```python
class CompetitorIn(BaseModel):
    platform: Literal["facebook", "instagram"]
    name: str = Field(min_length=1)
    external_id: str = ""
```

(`Field` is already imported at the top of the file.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `uv run pytest tests/api/test_competitor_schema.py -v`
Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
git add src/athena/api/schemas.py tests/api/test_competitor_schema.py
git commit -m "fix(api): require non-empty CompetitorIn.name (min_length=1)"
```

---

### Task 2: Scope `/research/internet-trends` to the latest window + dedupe

**Files:**
- Modify: `src/athena/features/research.py` (function `research_internet_trends`, ~lines 21-28)
- Test: `tests/features/test_research_trends.py`

- [ ] **Step 1: Write the failing tests**

Append to `tests/features/test_research_trends.py` (it already imports `datetime, timedelta, timezone`, `KeywordVolume`, `FakeLLM`, `TitleSuggestions`, `research_internet_trends`):

```python
def test_internet_trends_scopes_to_latest_window_and_dedupes(session):
    latest = datetime(2026, 7, 8, tzinfo=timezone.utc)
    stale = latest - timedelta(days=7)
    # Stale window: a huge-volume keyword that must NOT appear (wrong window).
    session.add(KeywordVolume(source_id="stale-1", keyword="stale storage",
                              weekly_search_volume=999999, window_date=stale))
    # Latest window: "self storage" ingested from two source_ids (a duplicate) + another.
    session.add(KeywordVolume(source_id="dup-a", keyword="self storage",
                              weekly_search_volume=40000, window_date=latest))
    session.add(KeywordVolume(source_id="dup-b", keyword="self storage",
                              weekly_search_volume=41000, window_date=latest))
    session.add(KeywordVolume(source_id="unit-1", keyword="storage units",
                              weekly_search_volume=30000, window_date=latest))
    session.commit()
    canned = TitleSuggestions(titles=["1", "2", "3", "4", "5"], prefill_prompt="p")
    out = research_internet_trends(session, FakeLLM({TitleSuggestions: canned}))
    kws = [k["keyword"] for k in out["keywords"]]
    assert "stale storage" not in kws                 # scoped to the latest window
    assert kws.count("self storage") == 1             # deduped by keyword
    vol = next(k["weekly_search_volume"] for k in out["keywords"]
               if k["keyword"] == "self storage")
    assert vol == 41000                               # keeps the higher of the two
    assert kws == ["self storage", "storage units"]   # ordered by volume desc


def test_internet_trends_empty_table_returns_no_keywords(session):
    canned = TitleSuggestions(titles=["a", "b", "c", "d", "e"], prefill_prompt="p")
    out = research_internet_trends(session, FakeLLM({TitleSuggestions: canned}))
    assert out["keywords"] == []
    assert out["titles"] == ["a", "b", "c", "d", "e"]
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `uv run pytest tests/features/test_research_trends.py -v`
Expected: the two new tests FAIL (current query mixes windows and returns the stale `999999` keyword / a duplicate). The pre-existing `test_internet_trends_top5_and_titles` still PASSES.
(Requires Docker/WSL bridge for the Postgres testcontainer.)

- [ ] **Step 3: Rewrite the query**

Replace the body of `research_internet_trends` in `src/athena/features/research.py` with:

```python
def research_internet_trends(session: Session, llm: LLMClient) -> dict:
    # Scope to the latest ingested window and dedupe by keyword server-side: the same
    # keyword recurs across windows/source_ids (the unique key is source_id+window_date,
    # not keyword), so a global top-5 would mix weeks and repeat terms.
    latest = session.query(func.max(KeywordVolume.window_date)).scalar()
    rows = []
    if latest is not None:
        rows = (session.query(KeywordVolume.keyword,
                              func.max(KeywordVolume.weekly_search_volume).label("vol"))
                .filter(KeywordVolume.window_date == latest)
                .group_by(KeywordVolume.keyword)
                .order_by(func.max(KeywordVolume.weekly_search_volume).desc())
                .limit(5).all())
    keywords = [{"keyword": kw, "weekly_search_volume": vol} for kw, vol in rows]
    context = "Top search keywords this week:\n" + "\n".join(
        f"- {k['keyword']}: {k['weekly_search_volume']}/wk" for k in keywords)
    titles = suggest_titles(session, llm, "internet_trends", context)
    return {"keywords": keywords, "titles": titles.titles, "prefill_prompt": titles.prefill_prompt}
```

(`func` is already imported: `from sqlalchemy import func`.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `uv run pytest tests/features/test_research_trends.py -v`
Expected: PASS (all three, including the original top-5 test).

- [ ] **Step 5: Commit**

```bash
git add src/athena/features/research.py tests/features/test_research_trends.py
git commit -m "fix(research): scope internet-trends to latest window and dedupe keywords"
```

---

### Task 3: Swap dependencies (drop langchain-openai, add langchain-anthropic)

**Files:**
- Modify: `pyproject.toml` (`[project].dependencies`)

- [ ] **Step 1: Edit dependencies**

In `pyproject.toml`, in `[project].dependencies`, remove the line:

```
    "langchain-openai>=1.0",
```

and add:

```
    "langchain-anthropic>=1.0",
```

Leave `langgraph>=1.0` and `langchain-core>=1.0` unchanged.

- [ ] **Step 2: Sync the environment**

Run: `uv sync --extra dev`
Expected: resolves and installs `langchain-anthropic` (and its `anthropic` dependency); removes `langchain-openai`. No errors.

Verify:
Run: `uv run python -c "import langchain_anthropic, anthropic; print('ok')"`
Expected: prints `ok`.

- [ ] **Step 3: Confirm the suite still collects/passes (fake mode)**

Run: `uv run pytest tests/ai/test_llm.py -v`
Expected: PASS (these use `FakeLLM` / default-fake `get_llm`; `OpenRouterLLM`'s `langchain_openai` import is lazy and not triggered).

- [ ] **Step 4: Commit**

```bash
git add pyproject.toml uv.lock
git commit -m "build(deps): drop langchain-openai, add langchain-anthropic"
```

(If there is no `uv.lock` in the repo, just `git add pyproject.toml`.)

---

### Task 4: Config — replace OpenRouter fields with Claude + Gemini

**Files:**
- Modify: `src/athena/config.py` (AI section, ~lines 58-65)
- Test: `tests/test_config.py`

- [ ] **Step 1: Update the config tests to the new field names**

In `tests/test_config.py`, inside `test_empty_env_values_keep_defaults`, replace:

```python
    assert s.image_model == "google/gemini-2.5-flash-image"
```

with:

```python
    assert s.claude_model == "claude-sonnet-5"
    assert s.gemini_image_model == "gemini-2.5-flash-image"
```

- [ ] **Step 2: Run to verify it fails**

Run: `uv run pytest tests/test_config.py -v`
Expected: `test_empty_env_values_keep_defaults` FAILS (`Settings` has no `claude_model` / `gemini_image_model` yet).

- [ ] **Step 3: Swap the config fields**

In `src/athena/config.py`, replace the `# LLM / AI layer` and `# Image generation ...` blocks:

```python
    # LLM / AI layer
    openrouter_api_key: str = ""
    deepseek_model: str = "deepseek/deepseek-v4-flash"
    llm_mode: str = "fake"

    # Image generation (via OpenRouter Images API; reuses openrouter_api_key)
    image_mode: str = "fake"                       # fake|live
    image_model: str = "google/gemini-2.5-flash-image"
```

with:

```python
    # AI: text (Anthropic Claude)
    claude_api_key: str = ""
    claude_model: str = "claude-sonnet-5"          # latest Sonnet
    llm_mode: str = "fake"                          # fake|live

    # AI: images (Google Gemini)
    gemini_api_key: str = ""
    gemini_image_model: str = "gemini-2.5-flash-image"
    image_mode: str = "fake"                        # fake|live
```

- [ ] **Step 4: Run the config tests**

Run: `uv run pytest tests/test_config.py -v`
Expected: PASS.
Note: `tests/ai/test_images.py` will now be RED (it still imports `OpenRouterImageClient`) — that is fixed in Task 6. Do not run the full suite yet.

- [ ] **Step 5: Commit**

```bash
git add src/athena/config.py tests/test_config.py
git commit -m "feat(config): replace OpenRouter fields with Claude + Gemini settings"
```

---

### Task 5: Text client — `AnthropicLLM`

**Files:**
- Modify: `src/athena/ai/llm.py`
- Test: `tests/ai/test_llm.py`

- [ ] **Step 1: Write the failing test**

Append to `tests/ai/test_llm.py`:

```python
def test_get_llm_live_returns_anthropic():
    from athena.ai.llm import AnthropicLLM
    llm = get_llm(Settings(llm_mode="live", claude_api_key="k"))
    assert isinstance(llm, AnthropicLLM)
```

- [ ] **Step 2: Run to verify it fails**

Run: `uv run pytest tests/ai/test_llm.py::test_get_llm_live_returns_anthropic -v`
Expected: FAIL (`AnthropicLLM` does not exist; `get_llm` live branch still builds `OpenRouterLLM`).

- [ ] **Step 3: Rewrite the live client**

In `src/athena/ai/llm.py`:

Remove the module-level constant `OPENROUTER_BASE = "https://openrouter.ai/api/v1"` and the entire `OpenRouterLLM` class. Add in their place:

```python
class AnthropicLLM:
    """Live client: Claude Sonnet via langchain-anthropic + structured output."""

    def __init__(self, settings: Settings):
        from langchain_anthropic import ChatAnthropic
        # No temperature: Sonnet 5 rejects non-default sampling params (400).
        # thinking disabled: constrained structured extraction; keeps latency/cost down
        # (Sonnet 5 runs adaptive thinking if `thinking` is omitted).
        self._model = ChatAnthropic(model=settings.claude_model,
                                    api_key=settings.claude_api_key,
                                    thinking={"type": "disabled"},
                                    max_tokens=4096)

    def structured(self, system: str, user: str, schema: type[M]) -> M:
        from langchain_core.messages import HumanMessage, SystemMessage
        log.info("llm call", extra={"schema": schema.__name__, "mode": "live"})
        return self._model.with_structured_output(schema).invoke(
            [SystemMessage(content=system), HumanMessage(content=user)])
```

Update `get_llm` at the bottom of the file:

```python
def get_llm(settings: Settings) -> LLMClient:
    if settings.llm_mode == "live":
        return AnthropicLLM(settings)
    return default_fake_llm()
```

Leave `LLMClient`, `FakeLLM`, and `default_fake_llm` unchanged.

- [ ] **Step 4: Run the test to verify it passes**

Run: `uv run pytest tests/ai/test_llm.py -v`
Expected: PASS (all four tests).

- [ ] **Step 5: Commit**

```bash
git add src/athena/ai/llm.py tests/ai/test_llm.py
git commit -m "feat(ai): AnthropicLLM (Claude Sonnet via langchain-anthropic), drop OpenRouterLLM"
```

---

### Task 6: Image client — `GeminiImageClient` + parity fixture

**Files:**
- Modify: `src/athena/ai/images.py`
- Rewrite: `tests/ai/test_images.py`
- Create: `src/athena/ai/fixtures/gemini_image.json`
- Create: `tests/fixtures_parity/test_gemini_image_parity.py`
- Delete: `src/athena/ai/fixtures/openrouter_image.json`, `tests/fixtures_parity/test_openrouter_image_parity.py`

- [ ] **Step 1: Rewrite the image-client tests**

Replace the entire contents of `tests/ai/test_images.py` with:

```python
import pytest

from athena.ai.images import (FakeImageClient, GeneratedImage, GeminiImageClient,
                              get_image_client, parse_gemini_image)
from athena.config import Settings


def test_fake_image_client_is_deterministic_and_keyless():
    img = FakeImageClient().generate("a clean self-storage unit, product style")
    assert isinstance(img, GeneratedImage)
    assert img.mime_type == "image/png"
    assert img.data_b64 and img.data_b64 == FakeImageClient().generate("other").data_b64


def test_parse_gemini_image():
    body = {"candidates": [{"content": {"parts": [
        {"inlineData": {"mimeType": "image/png", "data": "QUJD"}}]}}]}
    img = parse_gemini_image(body)
    assert img.data_b64 == "QUJD" and img.mime_type == "image/png"


def test_parse_gemini_image_empty_raises():
    with pytest.raises(ValueError, match="no image data"):
        parse_gemini_image({"candidates": []})


def test_factory_fake_by_default():
    assert isinstance(get_image_client(Settings(image_mode="fake")), FakeImageClient)


def test_factory_live():
    client = get_image_client(Settings(image_mode="live", gemini_api_key="k"))
    assert isinstance(client, GeminiImageClient)
```

- [ ] **Step 2: Run to verify it fails**

Run: `uv run pytest tests/ai/test_images.py -v`
Expected: FAIL at import (`GeminiImageClient` / `parse_gemini_image` do not exist yet).

- [ ] **Step 3: Rewrite the image module**

In `src/athena/ai/images.py`:

Remove `OPENROUTER_IMAGES_URL`, the `parse_openrouter_image` function, and the `OpenRouterImageClient` class. Keep `GeneratedImage`, `ImageClient`, `FakeImageClient`, and `_FAKE_PNG_B64`. Add the Gemini pieces:

```python
GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models"


def parse_gemini_image(body: dict) -> GeneratedImage:
    """Extract the first inline image from a Gemini generateContent response
    (candidates[0].content.parts[].inlineData{mimeType,data}). Safety-filtered
    prompts return 200 OK with empty candidates -> ValueError."""
    candidates = body.get("candidates") or []
    parts = (candidates[0].get("content", {}).get("parts") if candidates else None) or []
    for part in parts:
        inline = part.get("inlineData") or part.get("inline_data")
        if inline and inline.get("data"):
            return GeneratedImage(
                mime_type=inline.get("mimeType") or inline.get("mime_type") or "image/png",
                data_b64=inline["data"])
    raise ValueError(
        f"no image data in Gemini response (keys={list(body.keys())}, "
        f"finish={candidates[0].get('finishReason') if candidates else None})")


class GeminiImageClient:
    """Live client: image generation via Google Gemini's generateContent endpoint."""

    def __init__(self, settings: Settings):
        self._api_key = settings.gemini_api_key
        self._model = settings.gemini_image_model

    def generate(self, prompt: str, aspect_ratio: str = "1:1") -> GeneratedImage:
        import httpx
        log.info("image gen call", extra={"model": self._model, "mode": "live",
                                          "aspect_ratio": aspect_ratio})
        resp = httpx.post(
            f"{GEMINI_BASE}/{self._model}:generateContent",
            headers={"x-goog-api-key": self._api_key},
            json={"contents": [{"parts": [{"text": prompt}]}],
                  "generationConfig": {"responseModalities": ["IMAGE"],
                                       "imageConfig": {"aspectRatio": aspect_ratio}}},
            timeout=120.0)
        resp.raise_for_status()
        return parse_gemini_image(resp.json())
```

Update `get_image_client`:

```python
def get_image_client(settings: Settings) -> ImageClient:
    if settings.image_mode == "live":
        return GeminiImageClient(settings)
    return FakeImageClient()
```

- [ ] **Step 4: Run the image-client tests**

Run: `uv run pytest tests/ai/test_images.py -v`
Expected: PASS (all five).

- [ ] **Step 5: Replace the parity fixture**

Delete `src/athena/ai/fixtures/openrouter_image.json`.
Create `src/athena/ai/fixtures/gemini_image.json`:

```json
{
  "candidates": [
    {
      "content": {
        "parts": [
          { "inlineData": { "mimeType": "image/png", "data": "AA==" } }
        ]
      },
      "finishReason": "STOP"
    }
  ],
  "usageMetadata": { "promptTokenCount": 0, "candidatesTokenCount": 1, "totalTokenCount": 1 }
}
```

- [ ] **Step 6: Replace the parity test**

Delete `tests/fixtures_parity/test_openrouter_image_parity.py`.
Create `tests/fixtures_parity/test_gemini_image_parity.py`:

```python
import json
from pathlib import Path

from athena.adapters.parity import assert_same_shape

FIXTURE = Path(__file__).resolve().parents[2] / "src/athena/ai/fixtures/gemini_image.json"


def test_gemini_image_fixture_matches_documented_shape():
    reference = {
        "candidates": [
            {"content": {"parts": [{"inlineData": {"mimeType": "image/png", "data": "AA=="}}]},
             "finishReason": "STOP"}
        ],
        "usageMetadata": {"promptTokenCount": 0, "candidatesTokenCount": 1, "totalTokenCount": 1},
    }
    assert_same_shape(reference, json.loads(FIXTURE.read_text()))
```

- [ ] **Step 7: Run the parity test**

Run: `uv run pytest tests/fixtures_parity/test_gemini_image_parity.py -v`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/athena/ai/images.py tests/ai/test_images.py \
        src/athena/ai/fixtures/gemini_image.json tests/fixtures_parity/test_gemini_image_parity.py
git rm src/athena/ai/fixtures/openrouter_image.json tests/fixtures_parity/test_openrouter_image_parity.py
git commit -m "feat(ai): GeminiImageClient (native generateContent), drop OpenRouter images"
```

---

### Task 7: `.env.example` reorg + docs

**Files:**
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `docs/LIVE_API_VALIDATION.md`

- [ ] **Step 1: Reorganize the AI section of `.env.example`**

Replace the two blocks (`# --- AI (text via OpenRouter) ---` and `# --- Images (via OpenRouter Images API; same key as text) ---`, currently lines ~26-37) with:

```
# --- AI: text (Anthropic Claude) ---
CLAUDE_API_KEY=
# Text model id (default: claude-sonnet-5)
CLAUDE_MODEL=
# fake | live (default: fake)
LLM_MODE=

# --- AI: images (Google Gemini) ---
GEMINI_API_KEY=
# Image model id (default: gemini-2.5-flash-image)
GEMINI_IMAGE_MODEL=
# fake | live (default: fake)
IMAGE_MODE=
```

- [ ] **Step 2: Verify the config tests still pass (env-var count sanity)**

Run: `uv run pytest tests/test_config.py -v`
Expected: PASS — `test_empty_env_values_keep_defaults` asserts `>= 30` documented vars (the file has ~38 after this reorg) and the Claude/Gemini defaults.

- [ ] **Step 3: Update `README.md`**

Make these exact replacements:

Line ~58:
```
| `live` | Calls DeepSeek via OpenRouter — requires `OPENROUTER_API_KEY` and `DEEPSEEK_MODEL` |
```
→
```
| `live` | Calls Claude Sonnet (Anthropic) — requires `CLAUDE_API_KEY` (model via `CLAUDE_MODEL`, default `claude-sonnet-5`) |
```

Line ~69 — replace the trailing clause `these endpoints depend on the configured LLM (`LLM_MODE=fake` by default, `live` for DeepSeek via OpenRouter).` with:
```
these endpoints depend on the configured LLM (`LLM_MODE=fake` by default, `live` for Claude Sonnet via Anthropic).
```

Line ~97 — replace `Each option runs a caption → image-prompt → OpenRouter image chain and uploads the result to Canva.` with:
```
Each option runs a caption → image-prompt → Gemini image chain and uploads the result to Canva.
```

Lines ~106-107:
```
| `LLM_MODE` | `fake` | Captions/recommendations via DeepSeek (OpenRouter) — needs `OPENROUTER_API_KEY` |
| `IMAGE_MODE` | `fake` | Images via OpenRouter Images API (default model `google/gemini-2.5-flash-image`) — needs `OPENROUTER_API_KEY` (+ `IMAGE_MODEL`) |
```
→
```
| `LLM_MODE` | `fake` | Captions/recommendations via Claude Sonnet (Anthropic) — needs `CLAUDE_API_KEY` |
| `IMAGE_MODE` | `fake` | Images via Google Gemini (default model `gemini-2.5-flash-image`) — needs `GEMINI_API_KEY` (+ `GEMINI_IMAGE_MODEL`) |
```

Then confirm nothing else remains:
Run: `uv run rg -n "OpenRouter|OPENROUTER|DeepSeek|DEEPSEEK|IMAGE_MODEL" README.md || echo "clean"`
Expected: `clean` (or only intended matches). Fix any stragglers.

- [ ] **Step 4: Update `docs/LIVE_API_VALIDATION.md`**

- **Row 1** (the OpenRouter/DeepSeek row): change the API to **Anthropic Claude Sonnet**, the version/as-built to `Messages API via langchain-anthropic; model claude-sonnet-5; structured output; thinking disabled`, credentials to `CLAUDE_API_KEY`, `CLAUDE_MODEL`, and reset Status to `⏳ pending (re-validate after provider swap)`.
- **Row 2** (Gemini image): update Used-by/credentials to the native path — `GEMINI_API_KEY`, `GEMINI_IMAGE_MODEL`, `IMAGE_MODE=live`; endpoint `POST /v1beta/models/{model}:generateContent`, header `x-goog-api-key`, response `candidates[0].content.parts[].inlineData{mimeType,data}`. Leave Status `⏳ pending` until Task 8 runs.

(Row edits are prose; keep the surrounding table formatting intact. The Task 8 live run updates the Status cells.)

- [ ] **Step 5: Commit**

```bash
git add .env.example README.md docs/LIVE_API_VALIDATION.md
git commit -m "docs: point env, README, and validation checklist at Claude + Gemini"
```

---

### Task 8: Full-suite green + live validation

**Files:**
- Create (temporary): `<scratchpad>/live_check.py`

- [ ] **Step 1: Run the full test suite (fake mode)**

Run: `uv run pytest -q`
Expected: all PASS. (Needs the WSL Docker bridge for the DB-backed tests.)
If anything references OpenRouter, fix it before proceeding:
Run: `uv run rg -n "openrouter|OpenRouter|OPENROUTER|deepseek|DEEPSEEK|image_model|parse_openrouter|OpenRouterLLM|OpenRouterImageClient" src tests || echo "clean"`
Expected: `clean`.

- [ ] **Step 2: Write the live-validation script**

Create `<scratchpad>/live_check.py` (use the session scratchpad directory):

```python
import base64
from athena.config import Settings
from athena.ai.llm import AnthropicLLM
from athena.ai.images import GeminiImageClient
from athena.ai.schemas import TitleSuggestions

s = Settings()
print("llm_mode:", s.llm_mode, "| image_mode:", s.image_mode)
print("claude_model:", s.claude_model, "| gemini_image_model:", s.gemini_image_model)

# --- Text: exact structured-output call the research pipeline makes ---
system = ("You suggest exactly 5 punchy Instagram post titles for UrbanSpace self-storage "
          "and a one-line prefill prompt, returned via the structured schema.")
user = ("Research source: internet_trends\nContext:\n"
        "Top search keywords this week:\n- self storage: 41000/wk\n- storage units: 30000/wk")
ts = AnthropicLLM(s).structured(system, user, TitleSuggestions)
print("TITLES:", ts.titles)
print("PREFILL:", ts.prefill_prompt)
assert len(ts.titles) == 5, f"expected 5 titles, got {len(ts.titles)}"

# --- Image: exact generate call the post-generator makes ---
img = GeminiImageClient(s).generate(
    "Documentary 35mm photo: a clean self-storage unit with a labelled box on a shelf, "
    "Urban Orange door trim, available light.")
raw = base64.b64decode(img.data_b64)
print("IMAGE:", img.mime_type, "| bytes:", len(raw))
assert len(raw) > 1000, "image payload suspiciously small"

print("LIVE CHECK OK")
```

- [ ] **Step 3: Run the live validation**

Ensure `.env` has `LLM_MODE=live`, `IMAGE_MODE=live`, and the `CLAUDE_API_KEY` / `GEMINI_API_KEY` values (already present).
Run: `uv run python "<scratchpad>/live_check.py"`
Expected: prints 5 titles, a prefill prompt, an image mime + byte count, then `LIVE CHECK OK`.

**On failure — do not paper over it:**
- Claude `401/403` → report; the `CLAUDE_API_KEY` needs checking.
- Gemini `401/403` → **the `AQ.Ab8...` key format risk from the spec** — report it plainly so the user can confirm the key. Do not fake success.
- Schema/validation error from `structured(...)` → capture the raw error and report; may need a `max_tokens` bump or a schema note.

- [ ] **Step 4: Drive the end-to-end HTTP pipeline (if Docker/DB is up)**

Start the app against the live DB and hit the two live endpoints:

Run:
```bash
uv run uvicorn athena.api.app:app --port 8000 &
sleep 3
uv run python -c "import httpx; print(httpx.get('http://127.0.0.1:8000/research/internet-trends', timeout=120).json())"
```
Expected: JSON with `keywords`, five live `titles`, and a `prefill_prompt`. Stop the server afterward (`kill %1`).
(If the live Postgres/DB is not reachable in this environment, note that the endpoint path was validated at the client level in Step 3 and skip — state clearly that the HTTP round-trip was not exercised.)

- [ ] **Step 5: Record the validation result**

Update the **Status** cells of rows 1 (Claude) and 2 (Gemini) in `docs/LIVE_API_VALIDATION.md` to `✅ validated 2026-07-14` with a one-line note of what was confirmed (5 titles returned; image bytes returned). If a call failed, record `⚠️` with the observed error instead — do not mark validated.

- [ ] **Step 6: Delete the scratch script and commit the validation note**

```bash
git add docs/LIVE_API_VALIDATION.md
git commit -m "docs(validation): record live Claude + Gemini results"
```

(The scratchpad script lives outside the repo; nothing to remove from git.)

---

### Task 9: Wrap up

- [ ] **Step 1: Final full-suite run**

Run: `uv run pytest -q`
Expected: all PASS.

- [ ] **Step 2: Confirm the branch state**

Run: `git log --oneline main..HEAD`
Expected: the spec commit plus Task 1-8 commits, all on `feat/native-claude-gemini-apis`.

- [ ] **Step 3: Report**

Summarize: the two research fixes, the OpenRouter → Claude/Gemini swap, and the **actual** live-validation output (titles + image bytes, or the observed failure). Offer to open a PR (do not push/PR unless the user asks).

---

## Self-Review

- **Spec coverage:** Change 1 (internet-trends) → Task 2. Change 2 (CompetitorIn.name) → Task 1. Change 3 (config) → Task 4. Change 4 (AnthropicLLM) → Task 5. Change 5 (GeminiImageClient) → Task 6. Change 6 (deps) → Task 3. Change 7 (tests & docs) → Tasks 1/2/4/5/6/7. Change 8 (live validation) → Task 8. Gemini-key risk → Task 8 Step 3. All spec sections covered.
- **Placeholders:** none — every code/step block is concrete. README/LIVE_API_VALIDATION edits give exact before/after or exact field values.
- **Type consistency:** `AnthropicLLM`, `GeminiImageClient`, `parse_gemini_image`, `GEMINI_BASE`, config fields `claude_api_key` / `claude_model` / `gemini_api_key` / `gemini_image_model` are named identically across tasks and tests. `LLMClient.structured(system, user, schema)` and `ImageClient.generate(prompt, aspect_ratio)` signatures are unchanged, so callers keep working.
