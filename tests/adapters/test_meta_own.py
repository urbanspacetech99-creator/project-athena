import pytest

from athena.adapters.meta import MetaOwnPostsAdapter


def test_normalize_fb_posts_to_own_post_rows():
    rows = MetaOwnPostsAdapter(mode="fixture").fetch_normalized()
    fb = [r for r in rows if r["platform"] == "facebook"]
    assert fb[0]["source_id"] == "123456789012345_678901234567890"
    assert fb[0]["likes"] == 96
    assert fb[0]["interactions"] == 96 + 9 + 14
    assert "S$60/month" in fb[0]["content"]


def test_normalize_includes_ig_media():
    rows = MetaOwnPostsAdapter(mode="fixture").fetch_normalized()
    ig = [r for r in rows if r["platform"] == "instagram"]
    assert ig[0]["source_id"] == "17895695668004550"
    assert ig[0]["views"] == 2450
    assert ig[0]["likes"] == 92


def test_normalize_comments():
    a = MetaOwnPostsAdapter(mode="fixture")
    comments = a.normalize_comments(a.fetch_comments_fixture())
    assert len(comments) == 14
    assert comments[0]["post_source_id"] == "123456789012345_678901234567890"
    assert comments[0]["source_id"] == "123456789012345_678901234567890_998877665544332"
    assert "drive-up" in comments[0]["text"]
    posts = MetaOwnPostsAdapter(mode="fixture").fetch_normalized()
    fb_ids = {p["source_id"] for p in posts if p["platform"] == "facebook"}
    assert comments[0]["post_source_id"] in fb_ids


def test_fetch_live_raises_on_error_envelope(monkeypatch):
    """An {"error": {...}} body from the fb_posts graph call must raise, not silently
    normalize to zero posts -- proves the raise_on_error_envelope call-site wiring,
    not just the helper itself."""
    import httpx

    from athena.config import Settings

    class FakeErrResp:
        def json(self):
            return {"error": {"code": 190, "message": "invalid access token"}}

    monkeypatch.setattr(httpx.Client, "get", lambda self, *a, **k: FakeErrResp())

    adapter = MetaOwnPostsAdapter(mode="live", settings=Settings())
    with pytest.raises(RuntimeError, match="graph api"):
        adapter.fetch_live()


def test_fetch_comments_live_raises_on_error_envelope(monkeypatch):
    import httpx

    from athena.config import Settings

    class FakeErrResp:
        def json(self):
            return {"error": {"code": 190, "message": "invalid access token"}}

    monkeypatch.setattr(httpx.Client, "get", lambda self, *a, **k: FakeErrResp())

    adapter = MetaOwnPostsAdapter(mode="live", settings=Settings())
    with pytest.raises(RuntimeError, match="graph api"):
        adapter.fetch_comments_live("123_456")
