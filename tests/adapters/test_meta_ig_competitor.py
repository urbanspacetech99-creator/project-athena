import pytest

from athena.adapters.meta import MetaIGCompetitorAdapter
from athena.config import Settings


def test_fixture_normalizes_to_competitor_rows():
    adapter = MetaIGCompetitorAdapter(mode="fixture", competitor="Extra Space Asia",
                                      username="extraspaceasia")
    rows = adapter.fetch_normalized()
    assert rows, "fixture should yield rows"
    row = rows[0]
    assert row["platform"] == "instagram"
    assert row["competitor"] == "extraspaceasia"  # attribution from business_discovery.username
    assert set(row) == {"source_id", "competitor", "platform", "text",
                        "like_count", "comment_count", "window_date"}
    assert row["like_count"] == 42 and row["comment_count"] == 5   # first fixture media


def test_live_requires_username():
    adapter = MetaIGCompetitorAdapter(mode="live", competitor="X", username="")
    with pytest.raises(RuntimeError, match="username"):
        adapter.fetch_live()


def test_live_requires_ig_user_id():
    adapter = MetaIGCompetitorAdapter(mode="live", competitor="X", username="storhub_sg",
                                      settings=Settings(meta_ig_user_id=""))
    with pytest.raises(RuntimeError, match="meta_ig_user_id"):
        adapter.fetch_live()
