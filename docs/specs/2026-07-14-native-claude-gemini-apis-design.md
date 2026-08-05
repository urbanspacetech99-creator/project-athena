# Native Claude + Gemini APIs, plus two research-endpoint fixes

**Date:** 2026-07-14
**Branch:** `feat/native-claude-gemini-apis`

## Summary

Two things in one branch:

1. **Two small backend fixes** to the research surface — scope `/research/internet-trends`
   to the latest ingested window and dedupe server-side; add `min_length=1` to
   `CompetitorIn.name`.
2. **Replace OpenRouter** (used today for both text and image generation) with the
   **native provider APIs**: Anthropic Claude Sonnet (latest) for text via
   `langchain-anthropic`, and Google Gemini Flash image generation via the native
   `generateContent` REST endpoint. OpenRouter is removed entirely.

The AI layer keeps its existing `fake | live` mode split and the `LLMClient` /
`ImageClient` protocols, so callers (`deps.py` factories, `features/research.py`,
`features/aggregate.py`, the generate routes) are unaffected.

## Decisions (confirmed with the user)

- **Text SDK:** `langchain-anthropic` `ChatAnthropic(...).with_structured_output(schema)`
  — smallest diff from the current `OpenRouterLLM` and consistent with the LangChain /
  LangGraph stack already in use. (Native `anthropic` SDK was the alternative.)
- **Image SDK:** native Gemini `generateContent` REST via `httpx` — matches the existing
  `images.py` style, no heavy new dependency. (`google-genai` SDK was the alternative.)
- **Thinking:** explicitly **disabled** on the Sonnet calls (`thinking={"type":"disabled"}`).
  Structured extraction is constrained; disabling thinking keeps latency and token cost
  down (the feature-10 aggregator makes 5+ calls per run) and matches the old
  `temperature=0` deterministic intent. Sonnet 5 runs adaptive thinking if `thinking`
  is omitted, so it must be set explicitly.

## Change 1 — `/research/internet-trends`: latest window + server-side dedupe

**Today** (`src/athena/features/research.py`, `research_internet_trends`): orders *all*
`KeywordVolume` rows by `weekly_search_volume` desc and takes the top 5. This mixes every
ingested week and can return the same keyword multiple times (the unique constraint is
`(source_id, window_date)` — `keyword` is not unique, and the same keyword recurs across
windows/source_ids).

**Change:** resolve the latest `window_date`, filter to it, and dedupe by keyword in SQL:

```python
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
```

- Empty table → `latest is None` → empty `keywords`; `suggest_titles` still runs with an
  empty-context string (unchanged downstream behavior).
- `func` is already imported in `research.py`.

**Tests:** the existing `test_internet_trends_top5_and_titles` seeds one window with six
distinct keywords, so it still passes. Add a case that seeds a **stale** window (older
`window_date`, high volumes) plus the latest window containing a **duplicate** keyword
across two `source_id`s, and assert the result is scoped to the latest window and
deduped (keyword appears once, with the higher volume).

## Change 2 — `CompetitorIn.name` minimum length

`src/athena/api/schemas.py`:

```python
class CompetitorIn(BaseModel):
    platform: Literal["facebook", "instagram"]
    name: str = Field(min_length=1)   # was: name: str
    external_id: str = ""
```

`Field` is already imported. This matches the existing `CompetitorUpdateIn.name`
(`min_length=1`) and `KeywordIn.keyword` validation.

## Change 3 — Config: drop OpenRouter, add Claude + Gemini

`src/athena/config.py` — in the AI section:

Remove:
- `openrouter_api_key: str = ""`
- `deepseek_model: str = "deepseek/deepseek-v4-flash"`
- `image_model: str = "google/gemini-2.5-flash-image"`

Add:
- `claude_api_key: str = ""`
- `claude_model: str = "claude-sonnet-5"`
- `gemini_api_key: str = ""`
- `gemini_image_model: str = "gemini-2.5-flash-image"`

Keep `llm_mode` (`fake|live`) and `image_mode` (`fake|live`).

`.env` already carries `CLAUDE_API_KEY`, `GEMINI_API_KEY`, `LLM_MODE=live`,
`IMAGE_MODE=live` (pydantic-settings maps the upper-case env names to the fields). No new
values need to be appended. `.env.example` gets the AI section reorganized: an
`# --- AI: text (Anthropic Claude) ---` block (`CLAUDE_API_KEY`, `CLAUDE_MODEL`,
`LLM_MODE`) and an `# --- AI: images (Google Gemini) ---` block (`GEMINI_API_KEY`,
`GEMINI_IMAGE_MODEL`, `IMAGE_MODE`), replacing the two OpenRouter blocks.

## Change 4 — Text client: `AnthropicLLM` (langchain-anthropic)

`src/athena/ai/llm.py`:

- Remove `OPENROUTER_BASE` and `OpenRouterLLM`.
- Add `AnthropicLLM` implementing the existing `LLMClient` protocol
  (`structured(system, user, schema) -> M`):

```python
class AnthropicLLM:
    """Live client: Claude Sonnet via langchain-anthropic + structured output."""

    def __init__(self, settings: Settings):
        from langchain_anthropic import ChatAnthropic
        self._model = ChatAnthropic(model=settings.claude_model,
                                    api_key=settings.claude_api_key,
                                    thinking={"type": "disabled"},
                                    max_tokens=4096)
        # No temperature: Sonnet 5 rejects non-default sampling params (400).

    def structured(self, system: str, user: str, schema: type[M]) -> M:
        from langchain_core.messages import HumanMessage, SystemMessage
        log.info("llm call", extra={"schema": schema.__name__, "mode": "live"})
        return self._model.with_structured_output(schema).invoke(
            [SystemMessage(content=system), HumanMessage(content=user)])
```

- `get_llm`: `live` → `AnthropicLLM(settings)`, else `default_fake_llm()`.
- `FakeLLM` and `default_fake_llm` are unchanged.

## Change 5 — Image client: `GeminiImageClient` (httpx REST)

`src/athena/ai/images.py`:

- Remove `OPENROUTER_IMAGES_URL`, `OpenRouterImageClient`, `parse_openrouter_image`.
- Add the native Gemini endpoint constant, `parse_gemini_image`, and `GeminiImageClient`:

```python
GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models"

def parse_gemini_image(body: dict) -> GeneratedImage:
    """Extract the first inline image from a Gemini generateContent response:
    candidates[0].content.parts[].inlineData{mimeType, data}. Safety-filtered
    prompts return 200 OK with empty candidates -> ValueError."""
    candidates = body.get("candidates") or []
    parts = (candidates[0].get("content", {}).get("parts") if candidates else None) or []
    for part in parts:
        inline = part.get("inlineData") or part.get("inline_data")
        if inline and inline.get("data"):
            return GeneratedImage(
                mime_type=inline.get("mimeType") or inline.get("mime_type") or "image/png",
                data_b64=inline["data"])
    raise ValueError(f"no image data in Gemini response "
                     f"(keys={list(body.keys())}, "
                     f"finish={candidates[0].get('finishReason') if candidates else None})")

class GeminiImageClient:
    """Live client: image generation via Google Gemini generateContent."""

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

- `get_image_client`: `live` → `GeminiImageClient(settings)`, else `FakeImageClient()`.
- `GeneratedImage` and `FakeImageClient` are unchanged.
- Response parsing tolerates both camelCase (`inlineData`/`mimeType`) and snake_case
  (`inline_data`/`mime_type`) key spellings that Gemini responses have used.

## Change 6 — Dependencies

`pyproject.toml`:
- Remove `langchain-openai>=1.0` (only `OpenRouterLLM` used it).
- Add `langchain-anthropic>=1.0`.
- `langgraph` and `langchain-core` stay.

## Change 7 — Tests & docs

- `tests/ai/test_images.py`: rewrite for `GeminiImageClient` / `parse_gemini_image`;
  `parse` happy-path uses the documented `candidates[...].content.parts[].inlineData`
  shape; empty-`candidates` raises `ValueError`; live factory built with
  `Settings(image_mode="live", gemini_api_key="k")` is a `GeminiImageClient`.
- `tests/fixtures_parity/test_openrouter_image_parity.py` →
  `tests/fixtures_parity/test_gemini_image_parity.py`; replace the
  `src/athena/ai/fixtures/openrouter_image.json` fixture with `gemini_image.json`
  holding the documented Gemini response shape, asserted with `assert_same_shape`.
- `tests/test_config.py`: `s.image_model == ...` → `s.gemini_image_model ==
  "gemini-2.5-flash-image"`; add `s.claude_model == "claude-sonnet-5"`. The `>= 30`
  env-var-count sanity check still holds after the `.env.example` reorg.
- `tests/ai/test_llm.py`: unaffected (`FakeLLM` + default-fake `get_llm`); optionally
  add a live-factory assertion that `get_llm(Settings(llm_mode="live",
  claude_api_key="k"))` is an `AnthropicLLM` (construction does no network I/O).
- `docs/LIVE_API_VALIDATION.md`: rewrite row 1 (OpenRouter/DeepSeek → Anthropic Claude
  Sonnet) and update row 2 (Gemini) status after the live run below.
- `README.md`: replace OpenRouter mentions with Claude (text) + Gemini (image).

## Change 8 — Live validation

With live keys (`LLM_MODE=live`, `IMAGE_MODE=live`), exercise the real pipeline:

1. **Text:** `AnthropicLLM(settings).structured(system, user, TitleSuggestions)` returns a
   valid `TitleSuggestions` (5 titles + `prefill_prompt`).
2. **Image:** `GeminiImageClient(settings).generate("<prompt>")` returns a non-empty
   base64 PNG (`mime_type == "image/png"`, decodable `data_b64`).
3. **End-to-end pipeline:** drive `/research/internet-trends` (live Claude titles) and the
   post-generate image path (live Gemini) and confirm real output flows through.

Report actual output. Do not claim success without observed evidence.

### Risk — Gemini key format

The provisioned `GEMINI_API_KEY` starts with `AQ.Ab8...`, not the usual `AIza...`
AI-Studio format. It may be a newer/OAuth-style key. If the live image call returns
401/403, surface it plainly so the user can confirm the key — do not paper over an auth
failure.

## Out of scope

- `docs/diagrams/architecture.drawio` OpenRouter label (diagram asset; not load-bearing).
- Canva, Zoho, Meta, Google integrations — untouched.
- Any change to the `fake`-mode demo outputs.
