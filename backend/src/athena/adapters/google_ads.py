import json
from datetime import datetime, timezone
from pathlib import Path

import httpx

from athena.adapters.base import SourceAdapter, raise_on_error_envelope
from athena.adapters.google_auth import google_access_token
from athena.config import Settings

FIXTURE_DIR = Path(__file__).parent / "fixtures"
# v24 is the current major version (launched 2026-04, ~12-month support window; v25 not
# yet released). Request/response shape for customers.generateKeywordIdeas verified
# against official v24 docs on 2026-07-12: request keywordPlanNetwork + keywordSeed.keywords;
# response results[].text + results[].keywordIdeaMetrics.monthlySearchVolumes[]{year, month,
# monthlySearches}.
ADS = "https://googleads.googleapis.com/v24"
_MONTHS = {m: i for i, m in enumerate(
    ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY",
     "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"], start=1)}
_WEEKS_PER_MONTH = 4.345


class KeywordPlannerAdapter(SourceAdapter):
    source = "google_ads"

    def __init__(self, mode, settings: Settings | None = None,
                 keywords: list[str] | None = None):
        super().__init__(mode)
        self.settings = settings or Settings()
        self.keywords = keywords or []

    def _load(self, name: str):
        return json.loads((FIXTURE_DIR / name).read_text(encoding="utf-8"))

    def fetch_fixture(self, **kwargs):
        return self._load("google_ads_keyword_ideas.json")

    def fetch_live(self, **kwargs):
        if not self.keywords:
            raise RuntimeError("no enabled tracked keywords configured (see /config/keywords)")
        token = google_access_token(self.settings, self.source)
        cid = getattr(self.settings, "gads_customer_id", "") or ""
        headers = {"Authorization": f"Bearer {token}",
                   "developer-token": getattr(self.settings, "gads_developer_token", "") or "",
                   "login-customer-id": getattr(self.settings, "gads_login_customer_id", "") or ""}
        body = {"keywordPlanNetwork": "GOOGLE_SEARCH", "keywordSeed": {"keywords": self.keywords}}
        with httpx.Client(timeout=30) as c:
            resp = c.post(f"{ADS}/customers/{cid}:generateKeywordIdeas",
                          headers=headers, json=body).json()
        return raise_on_error_envelope(resp, "google ads api")

    def normalize(self, raw) -> list[dict]:
        rows = []
        for res in raw.get("results", []):
            metrics = res.get("keywordIdeaMetrics")
            if not metrics:
                continue
            vols = metrics.get("monthlySearchVolumes") or []
            if not vols:
                continue
            latest = max(vols, key=lambda v: (int(v["year"]), _MONTHS[v["month"]]))
            weekly = round(int(latest["monthlySearches"]) / _WEEKS_PER_MONTH)
            window = datetime(int(latest["year"]), _MONTHS[latest["month"]], 1, tzinfo=timezone.utc)
            kw = res["text"]
            rows.append({"source_id": kw, "keyword": kw,
                         "weekly_search_volume": weekly, "window_date": window})
        return rows
