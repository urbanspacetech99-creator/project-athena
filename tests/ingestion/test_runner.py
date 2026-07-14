from datetime import datetime, timezone
from athena.adapters.base import SourceAdapter
from athena.db.models import KeywordVolume
from athena.ingestion.runner import run_ingestion


class FakeKwAdapter(SourceAdapter):
    source = "google_ads"
    def fetch_live(self, **k): return self.fetch_fixture(**k)
    def fetch_fixture(self, **k):
        return {"results": [{"kw": "self storage", "vol": 100}, {"kw": "storage units", "vol": 50}]}
    def normalize(self, raw):
        return [{"source_id": r["kw"], "keyword": r["kw"], "weekly_search_volume": r["vol"],
                 "window_date": datetime(2026, 6, 1, tzinfo=timezone.utc)} for r in raw["results"]]


def test_run_ingestion_upserts_and_is_idempotent(session):
    adapter = FakeKwAdapter(mode="fixture")
    r1 = run_ingestion(adapter, session, KeywordVolume, conflict=("source_id", "window_date"))
    assert r1.inserted == 2 and r1.updated == 0
    r2 = run_ingestion(adapter, session, KeywordVolume, conflict=("source_id", "window_date"))
    assert r2.inserted == 0 and r2.updated == 2
    assert session.query(KeywordVolume).count() == 2
    assert r2.total == 2
