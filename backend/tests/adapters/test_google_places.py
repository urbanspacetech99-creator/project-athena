from datetime import datetime, timezone

import pytest

from athena.adapters.google_places import LEGACY, GooglePlacesReviewsAdapter
from athena.config import Settings

# 2023-11-14T22:13:20Z -- legacy reviews date-stamp with a unix epoch, not RFC 3339.
LEGACY_EPOCH = 1_700_000_000

def _denied(reason: str, message: str) -> dict:
    return {"error": {"code": 403, "status": "PERMISSION_DENIED", "message": message,
                      "details": [{"reason": reason,
                                   "metadata": {"service": "places.googleapis.com"}},
                                  {"@type": "type.googleapis.com/google.rpc.LocalizedMessage",
                                   "locale": "en-US", "message": message}]}}


SERVICE_DISABLED = _denied("SERVICE_DISABLED",
                           "Places API (New) has not been used in project 8367... before")
KEY_BLOCKED = _denied("API_KEY_SERVICE_BLOCKED",
                      "Requests to this API places.googleapis.com method "
                      "google.maps.places.v1.Places.GetPlace are blocked.")

LEGACY_BODY = {"status": "OK", "html_attributions": [],
               "result": {"rating": 4.8, "user_ratings_total": 800,
                          "reviews": [{"author_name": "Ivy C.", "rating": 5,
                                       "text": "Clean and well run.", "time": LEGACY_EPOCH}]}}


def _client_returning(*bodies):
    """Stub httpx.Client.get, handing back `bodies` in call order and recording the URLs."""
    calls: list[str] = []
    queue = list(bodies)

    class Resp:
        def __init__(self, body):
            self._body = body

        def json(self):
            return self._body

    def get(self, url, **kwargs):
        calls.append(url)
        return Resp(queue.pop(0))

    return get, calls


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


def _live_adapter():
    return GooglePlacesReviewsAdapter(
        mode="live", competitor="StorHub", place_id="ChIJstorhub0002",
        settings=Settings(_env_file=None, google_places_api_key="k"))


@pytest.mark.parametrize("denial", [SERVICE_DISABLED, KEY_BLOCKED],
                         ids=["service-disabled", "key-blocked"])
def test_live_falls_back_to_legacy_when_places_new_is_closed(monkeypatch, denial):
    """Both ways a project can be shut out of Places API (New) must still ingest, and the
    fallback payload must reshape into the (New) shape normalize reads."""
    import httpx

    get, calls = _client_returning(denial, LEGACY_BODY)
    monkeypatch.setattr(httpx.Client, "get", get)

    rows = _live_adapter().fetch_normalized()

    assert calls[0].endswith("/places/ChIJstorhub0002")   # (New) tried first
    assert calls[1] == LEGACY                             # then the fallback
    assert len(rows) == 1
    row = rows[0]
    assert row["place_rating"] == 4.8 and row["place_review_count"] == 800
    assert row["reviewer"] == "Ivy C." and row["star_rating"] == 5
    assert row["comment"] == "Clean and well run."
    assert row["window_date"] == datetime(2023, 11, 14, 22, 13, 20, tzinfo=timezone.utc)
    # No resource id on a legacy review -> the deterministic hash id, not a doubled prefix.
    assert row["source_id"].startswith("places/ChIJstorhub0002/reviews/")


def test_live_does_not_fall_back_on_other_errors(monkeypatch):
    """Only SERVICE_DISABLED reroutes. A bad key must surface, not quietly retry."""
    import httpx

    get, calls = _client_returning({"error": {"code": 403, "status": "PERMISSION_DENIED",
                                              "message": "API key not valid",
                                              "details": [{"reason": "API_KEY_INVALID"}]}})
    monkeypatch.setattr(httpx.Client, "get", get)

    with pytest.raises(RuntimeError, match="google places api error"):
        _live_adapter().fetch_live()
    assert len(calls) == 1


def test_legacy_failure_status_raises(monkeypatch):
    """Legacy reports failure as a status string, not an error envelope."""
    import httpx

    get, _ = _client_returning(SERVICE_DISABLED,
                               {"status": "REQUEST_DENIED",
                                "error_message": "This API project is not authorized."})
    monkeypatch.setattr(httpx.Client, "get", get)

    with pytest.raises(RuntimeError, match="legacy.*REQUEST_DENIED"):
        _live_adapter().fetch_live()
