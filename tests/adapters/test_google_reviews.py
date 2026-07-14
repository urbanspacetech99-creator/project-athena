import pytest

from athena.adapters.google_reviews import GoogleReviewsAdapter, _STAR


def test_star_enum_mapping():
    assert _STAR == {"STAR_RATING_UNSPECIFIED": 0, "ONE": 1, "TWO": 2, "THREE": 3, "FOUR": 4, "FIVE": 5}


def test_normalize_reviews():
    rows = GoogleReviewsAdapter(mode="fixture").fetch_normalized()
    assert len(rows) == 13
    assert rows[0]["source_id"] == "AbFvOqA1"
    assert rows[0]["star_rating"] == 5
    assert rows[0]["reviewer"] == "Priya Nair"
    anon = [r for r in rows if r["reviewer"] == ""]
    assert len(anon) == 1                     # anonymous -> no displayName
    assert anon[0]["star_rating"] == 1
    assert "Billing" in anon[0]["comment"]


def test_settings_declares_google_oauth_fields():
    from athena.config import Settings
    s = Settings()
    assert hasattr(s, "google_oauth_client_id")
    assert hasattr(s, "google_oauth_client_secret")


def test_fetch_live_raises_on_error_envelope(monkeypatch):
    """An {"error": {...}} body from the GBP reviews endpoint must raise, not silently
    normalize to zero reviews -- proves the raise_on_error_envelope call-site wiring,
    not just the helper itself."""
    import httpx

    from athena.config import Settings

    class FakeTokenResp:
        def raise_for_status(self):
            pass

        def json(self):
            return {"access_token": "tok"}

    class FakeReviewsResp:
        def json(self):
            return {"error": {"code": 401, "message": "invalid token"}}

    monkeypatch.setattr(httpx, "post", lambda *a, **k: FakeTokenResp())
    monkeypatch.setattr(httpx.Client, "get", lambda self, *a, **k: FakeReviewsResp())

    adapter = GoogleReviewsAdapter(mode="live", settings=Settings())
    with pytest.raises(RuntimeError, match="google business profile api"):
        adapter.fetch_live()
