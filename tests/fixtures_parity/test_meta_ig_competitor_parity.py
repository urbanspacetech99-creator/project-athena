import json
from pathlib import Path

from athena.adapters.parity import assert_same_shape

FIXTURE = Path(__file__).resolve().parents[2] / "src/athena/adapters/fixtures/meta_ig_competitor.json"


def test_ig_competitor_fixture_matches_documented_shape():
    reference = {"business_discovery": {
        "username": "extraspaceasia",
        "media": {"data": [{
            "id": "17900001",
            "caption": "text",
            "media_type": "IMAGE",
            "permalink": "https://www.instagram.com/p/x/",
            "timestamp": "2026-07-01T10:00:00+0000",
            "like_count": 1,
            "comments_count": 1,
        }]},
        "id": "17841400000000000"}}
    assert_same_shape(reference, json.loads(FIXTURE.read_text()))
