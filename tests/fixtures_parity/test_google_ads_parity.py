from athena.adapters.parity import assert_same_shape
from athena.adapters.google_ads import KeywordPlannerAdapter


def test_keyword_ideas_fixture_matches_documented_shape():
    # int64 fields are STRINGS in REST JSON
    reference = {"results": [{"text": "k",
                    "keywordIdeaMetrics": {"avgMonthlySearches": "0", "competition": "LOW", "competitionIndex": "0",
                        "monthlySearchVolumes": [{"year": "2026", "month": "JUNE", "monthlySearches": "0"}]},
                    "closeVariants": []}],
                 "nextPageToken": None, "totalSize": "0"}
    fixture = KeywordPlannerAdapter(mode="fixture")._load("google_ads_keyword_ideas.json")
    assert_same_shape(reference, fixture)
