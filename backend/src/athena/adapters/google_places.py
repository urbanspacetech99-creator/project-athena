# Verified against Google Places API (New) Place Details docs on 2026-07-16:
# GET https://places.googleapis.com/v1/places/{PLACE_ID}, API-key auth via
# X-Goog-Api-Key, required X-Goog-FieldMask. `reviews` is capped at 5 by the API.
#
# The legacy Place Details endpoint is kept as a fallback: a GCP project can have the
# legacy Places API enabled but not Places API (New), and that is the state of the
# project behind GOOGLE_PLACES_API_KEY (verified live 2026-08-07). Legacy caps reviews
# at 5 too, so the data is the same; only the payload shape differs, and _fetch_legacy
# reshapes it into the (New) shape so normalize stays one code path.
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx

from athena.adapters.base import SourceAdapter, raise_on_error_envelope
from athena.config import Settings
from athena.logging_setup import get_logger

log = get_logger("athena.adapters.google_places")

FIXTURE_DIR = Path(__file__).parent / "fixtures"
PLACES = "https://places.googleapis.com/v1/places"
FIELD_MASK = "id,rating,userRatingCount,reviews"
LEGACY = "https://maps.googleapis.com/maps/api/place/details/json"
LEGACY_FIELDS = "rating,user_ratings_total,reviews"


def _parse_rfc3339(ts: str) -> datetime:
    return datetime.fromisoformat(ts.replace("Z", "+00:00"))


# The two ways a project can be shut out of Places API (New), both reported as 403
# PERMISSION_DENIED and distinguished only by the ErrorInfo reason. Observed on this
# project 2026-08-07: searchText answered SERVICE_DISABLED, GetPlace API_KEY_SERVICE_BLOCKED.
# Everything else — invalid key, unknown place id, exhausted quota — must keep raising.
_NEW_API_UNAVAILABLE = frozenset({
    "SERVICE_DISABLED",         # the API is not enabled on the key's GCP project
    "API_KEY_SERVICE_BLOCKED",  # the key's API restrictions exclude places.googleapis.com
})


def _new_api_unavailable(body: Any) -> bool:
    """True only when Places API (New) is closed to this key by configuration."""
    err = body.get("error") if isinstance(body, dict) else None
    if not isinstance(err, dict):
        return False
    return any(isinstance(d, dict) and d.get("reason") in _NEW_API_UNAVAILABLE
               for d in err.get("details") or [])


class GooglePlacesReviewsAdapter(SourceAdapter):
    """Competitor Google reviews via the Places API (New) Place Details. Returns
    place-level rating + userRatingCount and up to 5 reviews. Works for any place_id."""

    source = "google_places"

    def __init__(self, mode, competitor: str, place_id: str = "",
                 settings: Settings | None = None):
        super().__init__(mode)
        self.competitor = competitor
        # Stored external_id may be the resource-name form ("places/ChIJ...") while the
        # Place Details URL expects the bare id (.../v1/places/{ID}); strip the prefix once
        # so both forms work and the fallback source_id never doubles it. "" stays "".
        self.place_id = place_id.removeprefix("places/")
        self.settings = settings or Settings()

    def _load(self, name: str) -> Any:
        return json.loads((FIXTURE_DIR / name).read_text(encoding="utf-8"))

    def fetch_fixture(self, **kwargs):
        data = self._load("google_competitor_reviews.json")
        return data.get(self.competitor, {"rating": 0, "userRatingCount": 0, "reviews": []})

    def fetch_live(self, **kwargs):
        if not self.place_id:
            raise RuntimeError(f"competitor {self.competitor!r} has no place_id configured")
        key = getattr(self.settings, "google_places_api_key", "") or ""
        with httpx.Client(timeout=30) as c:
            body = c.get(f"{PLACES}/{self.place_id}",
                         headers={"X-Goog-Api-Key": key,
                                  "X-Goog-FieldMask": FIELD_MASK}).json()
            if _new_api_unavailable(body):
                log.warning("places api (new) closed to this key; using the legacy Place "
                            "Details endpoint",
                            extra={"competitor": self.competitor, "place_id": self.place_id})
                return self._fetch_legacy(c, key)
        return raise_on_error_envelope(body, "google places api")

    def _fetch_legacy(self, client: httpx.Client, key: str) -> dict:
        """Legacy Place Details, reshaped into the Places (New) payload.

        Legacy reviews carry no resource id, so their rows take normalize's deterministic
        hash source_id. Enabling Places API (New) later swaps those for its `name`-based
        ids, which inserts the same reviews once more instead of updating them in place —
        a one-off duplication at the switchover, not ongoing drift.
        """
        body = client.get(LEGACY, params={"place_id": self.place_id,
                                          "fields": LEGACY_FIELDS, "key": key}).json()
        # Legacy signals failure with a top-level status string, not the (New) error
        # envelope raise_on_error_envelope handles.
        if body.get("status") != "OK":
            detail = " ".join(str(p) for p in
                              (body.get("status"), body.get("error_message")) if p)
            raise RuntimeError(f"google places api (legacy) error: {detail}")
        result = body.get("result") or {}
        return {
            "rating": result.get("rating", 0.0),
            "userRatingCount": result.get("user_ratings_total", 0),
            "reviews": [{
                "rating": rv.get("rating", 0),
                "text": {"text": rv.get("text", "")},
                "authorAttribution": {"displayName": rv.get("author_name", "")},
                # legacy `time` is a unix epoch in seconds; (New) publishTime is RFC 3339
                "publishTime": datetime.fromtimestamp(int(rv["time"]), tz=timezone.utc)
                                       .isoformat().replace("+00:00", "Z"),
            } for rv in result.get("reviews") or []],
        }

    def normalize(self, raw) -> list[dict]:
        place_rating = float(raw.get("rating", 0.0) or 0.0)
        place_count = int(raw.get("userRatingCount", 0) or 0)
        rows = []
        for r in raw.get("reviews", []):
            author = (r.get("authorAttribution") or {}).get("displayName", "")
            published = r["publishTime"]   # required; fail fast like the sibling adapters
            text = (r.get("text") or {}).get("text", "")
            # Places (New) reviews carry a `name` resource id; fall back to a deterministic
            # hash so upserts stay idempotent even if a payload omits it.
            sid = r.get("name") or ("places/" + self.place_id + "/reviews/" +
                  hashlib.sha1(f"{self.place_id}|{author}|{published}".encode()).hexdigest()[:16])
            rows.append({
                "source_id": sid,
                "competitor": self.competitor,
                "star_rating": int(round(r.get("rating", 0) or 0)),
                "comment": text,
                "reviewer": author,
                "place_rating": place_rating,
                "place_review_count": place_count,
                "window_date": _parse_rfc3339(published),
            })
        return rows
