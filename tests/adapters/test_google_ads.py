import pytest

from athena.adapters.google_ads import KeywordPlannerAdapter


def test_normalize_keyword_volumes_derives_weekly_from_latest_month():
    rows = KeywordPlannerAdapter(mode="fixture").fetch_normalized()
    by_kw = {r["keyword"]: r for r in rows}
    # latest month is JULY 2026: self storage singapore 4000 -> round(4000/4.345)=921
    assert by_kw["self storage singapore"]["weekly_search_volume"] == 921
    assert by_kw["self storage singapore"]["source_id"] == "self storage singapore"
    wd = by_kw["self storage singapore"]["window_date"]
    assert (wd.year, wd.month, wd.day) == (2026, 7, 1)
    assert wd.tzinfo is not None
    # hot desk singapore JULY 1600 -> round(1600/4.345)=368
    assert by_kw["hot desk singapore"]["weekly_search_volume"] == 368


def test_int64_strings_are_parsed():
    rows = KeywordPlannerAdapter(mode="fixture").fetch_normalized()
    assert all(isinstance(r["weekly_search_volume"], int) for r in rows)


def test_live_requires_keywords():
    adapter = KeywordPlannerAdapter(mode="live", keywords=[])
    with pytest.raises(RuntimeError, match="keywords"):
        adapter.fetch_live()
