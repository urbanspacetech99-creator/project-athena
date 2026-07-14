import json
from datetime import datetime
from pathlib import Path

import httpx

from athena.adapters.base import SourceAdapter, raise_on_error_envelope
from athena.adapters.google_auth import google_access_token
from athena.config import Settings

FIXTURE_DIR = Path(__file__).parent / "fixtures"
# Reviews are only available on the legacy v4 My Business API (verified against
# official docs 2026-07-12). Live access additionally requires GBP API quota
# approval for the GCP project — see docs/LIVE_API_VALIDATION.md.
GBP = "https://mybusiness.googleapis.com/v4"
_STAR = {"STAR_RATING_UNSPECIFIED": 0, "ONE": 1, "TWO": 2, "THREE": 3, "FOUR": 4, "FIVE": 5}


def _parse_rfc3339(ts: str) -> datetime:
    return datetime.fromisoformat(ts.replace("Z", "+00:00"))


class GoogleReviewsAdapter(SourceAdapter):
    source = "google_reviews"

    def __init__(self, mode, settings: Settings | None = None):
        super().__init__(mode)
        self.settings = settings or Settings()

    def _load(self, name: str):
        return json.loads((FIXTURE_DIR / name).read_text(encoding="utf-8"))

    def fetch_fixture(self, **kwargs):
        return self._load("google_reviews.json")

    def fetch_live(self, **kwargs):
        token = google_access_token(self.settings)
        acct = getattr(self.settings, "gbp_account_id", "") or ""
        loc = getattr(self.settings, "gbp_location_id", "") or ""
        with httpx.Client(timeout=30) as c:
            body = c.get(f"{GBP}/accounts/{acct}/locations/{loc}/reviews",
                         headers={"Authorization": f"Bearer {token}"}).json()
        return raise_on_error_envelope(body, "google business profile api")

    def normalize(self, raw) -> list[dict]:
        rows = []
        for r in raw.get("reviews", []):
            reviewer = r.get("reviewer", {})
            rows.append({
                "source_id": r["reviewId"],
                "star_rating": _STAR.get(r.get("starRating", "STAR_RATING_UNSPECIFIED"), 0),
                "comment": r.get("comment", ""),
                "reviewer": reviewer.get("displayName", ""),
                "window_date": _parse_rfc3339(r["createTime"]),
            })
        return rows
