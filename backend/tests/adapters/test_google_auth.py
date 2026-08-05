import httpx
import pytest

from athena.adapters.google_auth import google_access_token
from athena.config import Settings

ADWORDS = "https://www.googleapis.com/auth/adwords"
BUSINESS = "https://www.googleapis.com/auth/business.manage"


class FakeResp:
    def __init__(self, body, status_code=200):
        self._body, self.status_code, self.text = body, status_code, str(body)

    def json(self):
        return self._body


def _patch_post(monkeypatch, body, status_code=200) -> dict:
    """Stub the token endpoint and return the form data google_access_token posts, so a
    test can prove WHICH refresh token went out."""
    sent: dict = {}

    def fake_post(url, data=None, **kwargs):
        sent.update(data or {})
        return FakeResp(body, status_code)

    monkeypatch.setattr(httpx, "post", fake_post)
    return sent


def _settings(**kw) -> Settings:
    """Hermetic settings: init args beat env vars, so a developer's exported GOOGLE_*
    credentials cannot leak in and mask a missing-token assertion."""
    creds = dict(google_reviews_refresh_token="", google_ads_refresh_token="",
                 google_oauth_client_id="cid", google_oauth_client_secret="secret")
    creds.update(kw)
    return Settings(_env_file=None, **creds)


def test_each_source_sends_its_own_refresh_token(monkeypatch):
    """Reviews and ads hold independent grants. Before this, both read one shared
    variable, so the second token pasted into .env silently displaced the first."""
    s = _settings(google_reviews_refresh_token="reviews-rt", google_ads_refresh_token="ads-rt")

    sent = _patch_post(monkeypatch, {"access_token": "a", "scope": BUSINESS})
    assert google_access_token(s, "google_reviews") == "a"
    assert sent["refresh_token"] == "reviews-rt"

    sent = _patch_post(monkeypatch, {"access_token": "b", "scope": ADWORDS})
    assert google_access_token(s, "google_ads") == "b"
    assert sent["refresh_token"] == "ads-rt"


def test_one_account_owning_both_sets_the_same_token_twice(monkeypatch):
    """`--source both`: a single consent covering both scopes fills both variables, and
    that one token authenticates either source."""
    both = f"{BUSINESS} {ADWORDS}"
    s = _settings(google_reviews_refresh_token="both-rt", google_ads_refresh_token="both-rt")
    for source in ("google_reviews", "google_ads"):
        sent = _patch_post(monkeypatch, {"access_token": "a", "scope": both})
        assert google_access_token(s, source) == "a"
        assert sent["refresh_token"] == "both-rt"


def test_missing_token_names_the_variable_to_set():
    with pytest.raises(RuntimeError, match="GOOGLE_ADS_REFRESH_TOKEN"):
        google_access_token(_settings(), "google_ads")


def test_the_other_apis_token_is_caught_by_scope(monkeypatch):
    """The ads grant pasted into the reviews variable: named here at auth time rather
    than surfacing as an opaque 403 from the reviews endpoint."""
    s = _settings(google_reviews_refresh_token="actually-the-ads-token")
    _patch_post(monkeypatch, {"access_token": "a", "scope": ADWORDS})
    with pytest.raises(RuntimeError, match="does not include .*business.manage"):
        google_access_token(s, "google_reviews")


def test_deprecated_business_scope_is_still_accepted(monkeypatch):
    # Tokens minted before the plus.business.manage rename still work against v4 reviews.
    s = _settings(google_reviews_refresh_token="legacy-rt")
    _patch_post(monkeypatch, {"access_token": "a",
                              "scope": "https://www.googleapis.com/auth/plus.business.manage"})
    assert google_access_token(s, "google_reviews") == "a"


def test_absent_scope_field_does_not_block(monkeypatch):
    # Only a scope Google actually reported can be judged; silence is not a mismatch.
    s = _settings(google_ads_refresh_token="rt")
    _patch_post(monkeypatch, {"access_token": "a"})
    assert google_access_token(s, "google_ads") == "a"


def test_error_response_surfaces_googles_description(monkeypatch):
    s = _settings(google_ads_refresh_token="revoked-rt")
    _patch_post(monkeypatch, {"error": "invalid_grant",
                              "error_description": "Token has been expired or revoked."},
                status_code=400)
    with pytest.raises(RuntimeError, match="expired or revoked"):
        google_access_token(s, "google_ads")


def test_success_body_without_access_token_raises(monkeypatch):
    s = _settings(google_ads_refresh_token="rt")
    _patch_post(monkeypatch, {"scope": ADWORDS})
    with pytest.raises(RuntimeError, match="no access_token"):
        google_access_token(s, "google_ads")


def test_source_without_google_oauth_is_rejected():
    # google_places authenticates with an API key, so it has no grant to resolve.
    with pytest.raises(ValueError, match="does not use google oauth"):
        google_access_token(_settings(), "google_places")
