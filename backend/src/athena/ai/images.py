from typing import Protocol

from pydantic import BaseModel

from athena.config import Settings
from athena.logging_setup import get_logger

log = get_logger("athena.ai.images")

GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models"

# 1x1 transparent PNG — deterministic stand-in when no image API key is present.
_FAKE_PNG_B64 = ("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4"
                 "2mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==")


class GeneratedImage(BaseModel):
    mime_type: str
    data_b64: str


class ImageClient(Protocol):
    def generate(self, prompt: str, aspect_ratio: str = "1:1") -> GeneratedImage: ...


def parse_gemini_image(body: dict) -> GeneratedImage:
    """Extract the first inline image from a Gemini generateContent response
    (candidates[0].content.parts[].inlineData{mimeType,data}). Safety-filtered
    prompts return 200 OK with empty candidates -> ValueError."""
    candidates = body.get("candidates") or []
    parts = ((candidates[0].get("content") or {}).get("parts") if candidates else None) or []
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


class FakeImageClient:
    """Deterministic client for tests / no-key dev. Returns a fixed 1x1 PNG."""

    def generate(self, prompt: str, aspect_ratio: str = "1:1") -> GeneratedImage:
        log.info("image gen call", extra={"model": "fake", "mode": "fake",
                                          "aspect_ratio": aspect_ratio})
        return GeneratedImage(mime_type="image/png", data_b64=_FAKE_PNG_B64)


def get_image_client(settings: Settings) -> ImageClient:
    if settings.image_mode == "live":
        return GeminiImageClient(settings)
    return FakeImageClient()
