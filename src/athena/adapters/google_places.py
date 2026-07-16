# Verified against Google Places API (New) Place Details docs on 2026-07-16:
# GET https://places.googleapis.com/v1/places/{PLACE_ID}, API-key auth via
# X-Goog-Api-Key, required X-Goog-FieldMask. `reviews` is capped at 5 by the API.
import hashlib
import json
from datetime import datetime
from pathlib import Path
from typing import Any

import httpx

from athena.adapters.base import SourceAdapter, raise_on_error_envelope
from athena.config import Settings

FIXTURE_DIR = Path(__file__).parent / "fixtures"
PLACES = "https://places.googleapis.com/v1/places"
FIELD_MASK = "id,rating,userRatingCount,reviews"


def _parse_rfc3339(ts: str) -> datetime:
    return datetime.fromisoformat(ts.replace("Z", "+00:00"))


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
        return raise_on_error_envelope(body, "google places api")

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
