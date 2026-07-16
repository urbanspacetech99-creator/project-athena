import json
from pathlib import Path

from athena.adapters.parity import assert_same_shape

FIXTURE = Path(__file__).resolve().parents[2] / "src/athena/adapters/fixtures/google_competitor_reviews.json"


def test_places_fixture_matches_documented_shape():
    # Documented Places API (New) Place Details shape (fields the adapter relies on).
    reference = {
        "id": "places/x",
        "rating": 4.4,
        "userRatingCount": 1,
        "reviews": [{
            "name": "places/x/reviews/y",
            "rating": 5,
            "text": {"text": "c", "languageCode": "en"},
            "originalText": {"text": "c", "languageCode": "en"},
            "authorAttribution": {"displayName": "d", "uri": "u", "photoUri": "p"},
            "publishTime": "2026-07-10T08:00:00Z",
            "relativePublishTimeDescription": "5 days ago",
        }],
    }
    data = json.loads(FIXTURE.read_text(encoding="utf-8"))
    assert data, "fixture must have at least one competitor"
    for place in data.values():
        assert_same_shape(reference, place)
