from athena.adapters.parity import assert_same_shape
from athena.adapters.meta import MetaCompetitorAdapter


def test_competitor_posts_fixture_matches_documented_shape():
    reference = {"data": [{"id": "x", "created_time": "t", "message": "m", "permalink_url": "u",
                           "from": {"name": "n", "id": "i"}, "shares": {"count": 0},
                           "reactions": {"data": [], "summary": {"total_count": 0, "viewer_reaction": "NONE"}},
                           "comments": {"data": [], "summary": {"order": "chronological", "total_count": 0, "can_comment": True}}}],
                 "paging": {"cursors": {"before": "b", "after": "a"}, "next": "n"}}
    fixture = MetaCompetitorAdapter(mode="fixture", competitor="X")._load("meta_competitor_posts.json")
    assert_same_shape(reference, fixture)


def test_competitor_comments_fixture_matches_documented_shape():
    reference = {"data": [{"id": "i", "message": "m", "created_time": "t",
                           "from": {"id": "i"}, "like_count": 0, "comment_count": 0}],
                 "paging": {"cursors": {"before": "b", "after": "a"}},
                 "summary": {"order": "chronological", "total_count": 0, "can_comment": True}}
    fixture = MetaCompetitorAdapter(mode="fixture", competitor="X")._load("meta_competitor_comments.json")
    assert_same_shape(reference, fixture)
