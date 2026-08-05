import pytest

from athena.adapters.google_places import GooglePlacesReviewsAdapter
from athena.config import Settings


def test_fixture_normalizes_to_review_rows():
    adapter = GooglePlacesReviewsAdapter(mode="fixture", competitor="StorHub", place_id="")
    rows = adapter.fetch_normalized()
    assert rows, "fixture should yield rows"
    assert len(rows) <= 5                      # Places API caps reviews at 5
    row = rows[0]
    assert row["competitor"] == "StorHub"
    assert row["place_rating"] == 4.4 and row["place_review_count"] == 210
    assert row["reviewer"] == "Zack T." and row["star_rating"] == 5
    assert row["comment"] == "Best-in-class facilities."
    assert set(row) == {"source_id", "competitor", "star_rating", "comment", "reviewer",
                        "place_rating", "place_review_count", "window_date"}


def test_unknown_competitor_yields_no_rows():
    adapter = GooglePlacesReviewsAdapter(mode="fixture", competitor="Nobody", place_id="")
    assert adapter.fetch_normalized() == []


def test_place_id_prefix_stripped_and_source_id_not_doubled():
    # external_id stored as the resource-name form must be normalised to the bare id, and
    # the fallback source_id (when a review omits `name`) must not double the prefix.
    adapter = GooglePlacesReviewsAdapter(mode="fixture", competitor="StorHub",
                                         place_id="places/ChIJstorhub0002")
    assert adapter.place_id == "ChIJstorhub0002"
    rows = adapter.normalize({
        "rating": 4.4, "userRatingCount": 210,
        "reviews": [{"rating": 5,
                     "text": {"text": "No name key here.", "languageCode": "en"},
                     "authorAttribution": {"displayName": "Anon"},
                     "publishTime": "2026-07-11T10:00:00Z"}],
    })
    assert rows[0]["source_id"].startswith("places/ChIJstorhub0002/reviews/")


def test_live_requires_place_id():
    adapter = GooglePlacesReviewsAdapter(mode="live", competitor="X", place_id="",
                                         settings=Settings())
    with pytest.raises(RuntimeError, match="place_id"):
        adapter.fetch_live()
