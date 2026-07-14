from datetime import datetime, timedelta, timezone
from athena.db.models import KeywordVolume
from athena.ai.llm import FakeLLM
from athena.ai.schemas import TitleSuggestions
from athena.features.research import research_internet_trends


def test_internet_trends_top5_and_titles(session):
    ref = datetime(2026, 7, 8, tzinfo=timezone.utc)
    for kw, vol in [("self storage", 40000), ("storage units", 30000), ("climate storage", 20000),
                    ("business storage", 10000), ("student storage", 5000), ("rv storage", 1000)]:
        session.add(KeywordVolume(source_id=kw, keyword=kw, weekly_search_volume=vol,
                                  window_date=ref - timedelta(days=1)))
    session.commit()
    canned = TitleSuggestions(titles=["1", "2", "3", "4", "5"], prefill_prompt="p")
    out = research_internet_trends(session, FakeLLM({TitleSuggestions: canned}))
    kws = [k["keyword"] for k in out["keywords"]]
    assert kws == ["self storage", "storage units", "climate storage", "business storage", "student storage"]
    assert out["titles"] == ["1", "2", "3", "4", "5"]
    assert out["prefill_prompt"] == "p"


def test_internet_trends_scopes_to_latest_window_and_dedupes(session):
    latest = datetime(2026, 7, 8, tzinfo=timezone.utc)
    stale = latest - timedelta(days=7)
    # Stale window: a huge-volume keyword that must NOT appear (wrong window).
    session.add(KeywordVolume(source_id="stale-1", keyword="stale storage",
                              weekly_search_volume=999999, window_date=stale))
    # Latest window: "self storage" ingested from two source_ids (a duplicate) + another.
    session.add(KeywordVolume(source_id="dup-a", keyword="self storage",
                              weekly_search_volume=40000, window_date=latest))
    session.add(KeywordVolume(source_id="dup-b", keyword="self storage",
                              weekly_search_volume=41000, window_date=latest))
    session.add(KeywordVolume(source_id="unit-1", keyword="storage units",
                              weekly_search_volume=30000, window_date=latest))
    session.commit()
    canned = TitleSuggestions(titles=["1", "2", "3", "4", "5"], prefill_prompt="p")
    out = research_internet_trends(session, FakeLLM({TitleSuggestions: canned}))
    kws = [k["keyword"] for k in out["keywords"]]
    assert "stale storage" not in kws                 # scoped to the latest window
    assert kws.count("self storage") == 1             # deduped by keyword
    vol = next(k["weekly_search_volume"] for k in out["keywords"]
               if k["keyword"] == "self storage")
    assert vol == 41000                               # keeps the higher of the two
    assert kws == ["self storage", "storage units"]   # ordered by volume desc


def test_internet_trends_empty_table_returns_no_keywords(session):
    canned = TitleSuggestions(titles=["a", "b", "c", "d", "e"], prefill_prompt="p")
    out = research_internet_trends(session, FakeLLM({TitleSuggestions: canned}))
    assert out["keywords"] == []
    assert out["titles"] == ["a", "b", "c", "d", "e"]
