import pytest

from athena.adapters.meta import MetaCompetitorAdapter
from athena.config import Settings


def test_competitor_normalize_posts():
    a = MetaCompetitorAdapter(mode="fixture", competitor="StorHub")
    rows = a.fetch_normalized()
    assert rows[0]["source_id"] == "444000111222333_900000000001"
    assert rows[0]["competitor"] == "Extra Space Asia"
    assert "Storage sale" in rows[0]["text"]
    storhub_rows = [r for r in rows if r["competitor"] == "StorHub"]
    assert storhub_rows and "Grand opening" in storhub_rows[0]["text"]


def test_competitor_normalize_comments_linkage():
    a = MetaCompetitorAdapter(mode="fixture", competitor="StorHub")
    comments = a.normalize_comments(a.fetch_comments_fixture())
    assert len(comments) == 8
    assert comments[0]["post_source_id"] == "555000111222333_888999000111222"
    assert comments[0]["source_id"].endswith("_777666555444333")


def test_competitor_live_disabled_raises():
    a = MetaCompetitorAdapter(mode="live", competitor="StorHub", settings=Settings())
    with pytest.raises(RuntimeError, match="PPCA"):
        a.fetch_live()


def test_normalize_stamps_platform_and_prefers_from_name():
    adapter = MetaCompetitorAdapter(mode="fixture", competitor="Fallback Name")
    raw = {"data": [
        {"id": "555_1", "message": "promo", "created_time": "2026-07-01T10:00:00+0000",
         "from": {"name": "StorHub", "id": "555000111222333"}},
        {"id": "556_1", "message": "no from field", "created_time": "2026-07-01T11:00:00+0000"},
    ]}
    rows = adapter.normalize(raw)
    assert rows[0]["platform"] == "facebook"
    assert rows[0]["competitor"] == "StorHub"
    assert rows[1]["competitor"] == "Fallback Name"


def test_live_requires_page_id(monkeypatch):
    monkeypatch.setenv("COMPETITOR_LIVE_ACCESS_ENABLED", "true")
    adapter = MetaCompetitorAdapter(mode="live", competitor="X", page_id="")
    with pytest.raises(RuntimeError, match="page_id"):
        adapter.fetch_live()
