from athena.adapters.parity import assert_same_shape
from athena.adapters.meta import MetaOwnPostsAdapter


def test_fb_posts_fixture_matches_documented_shape():
    reference = {"data": [{"id": "x", "created_time": "t", "message": "m", "permalink_url": "u",
                           "shares": {"count": 0},
                           "reactions": {"data": [], "summary": {"total_count": 0, "viewer_reaction": "NONE"}},
                           "comments": {"data": [], "summary": {"order": "chronological", "total_count": 0, "can_comment": True}}}],
                 "paging": {"cursors": {"before": "b", "after": "a"}, "next": "n"}}
    fixture = MetaOwnPostsAdapter(mode="fixture")._load("meta_own_posts.json")
    assert_same_shape(reference, fixture)


def test_ig_media_fixture_matches_documented_shape():
    reference = {"data": [{"id": "x", "caption": "c", "media_type": "IMAGE", "media_product_type": "FEED",
                           "timestamp": "t", "permalink": "p", "username": "u",
                           "like_count": 0, "comments_count": 0}],
                 "paging": {"cursors": {"before": "b", "after": "a"}, "next": "n"}}
    fixture = MetaOwnPostsAdapter(mode="fixture")._load("meta_ig_media.json")
    assert_same_shape(reference, fixture)


def test_ig_insights_fixture_matches_documented_shape():
    # normalize reads d["name"] and d["values"][0]["value"]; the fixture is a dict keyed
    # by IG media id (one entry per record in meta_ig_media.json) -> per-media payload
    # matches the documented Graph API /{media-id}/insights response shape.
    reference = {"data": [{"name": "reach", "period": "lifetime", "title": "t",
                           "description": "d", "values": [{"value": 0}], "id": "i"}]}
    fixture = MetaOwnPostsAdapter(mode="fixture")._load("meta_ig_insights.json")
    assert fixture, "fixture should have at least one media id"
    first_id = next(iter(fixture))
    assert_same_shape(reference, fixture[first_id])


def test_own_comments_fixture_matches_documented_shape():
    # normalize_comments reads id, message, created_time
    reference = {"data": [{"id": "i", "message": "m", "created_time": "t",
                           "from": {"id": "i"}, "like_count": 0, "comment_count": 0}],
                 "paging": {"cursors": {"before": "b", "after": "a"}},
                 "summary": {"order": "chronological", "total_count": 0, "can_comment": True}}
    fixture = MetaOwnPostsAdapter(mode="fixture")._load("meta_own_comments.json")
    assert_same_shape(reference, fixture)
