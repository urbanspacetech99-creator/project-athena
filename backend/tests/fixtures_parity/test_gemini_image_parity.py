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
