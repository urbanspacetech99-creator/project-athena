import pytest

from athena.adapters.base import SourceAdapter, raise_on_error_envelope


class FakeAdapter(SourceAdapter):
    source = "fake"

    def fetch_live(self, **kwargs):
        return {"data": [{"id": "live1"}], "paging": {}}

    def fetch_fixture(self, **kwargs):
        return {"data": [{"id": "fix1"}], "paging": {}}

    def normalize(self, raw):
        return [row["id"] for row in raw["data"]]


def test_fetch_dispatches_on_mode():
    assert FakeAdapter(mode="live").fetch()["data"][0]["id"] == "live1"
    assert FakeAdapter(mode="fixture").fetch()["data"][0]["id"] == "fix1"


def test_fetch_normalized_runs_shared_normalizer():
    assert FakeAdapter(mode="fixture").fetch_normalized() == ["fix1"]


def test_invalid_mode_rejected():
    with pytest.raises(ValueError):
        FakeAdapter(mode="bogus")


def test_missing_source_attr_rejected():
    class NoSource(SourceAdapter):
        def fetch_live(self, **k): return {}
        def fetch_fixture(self, **k): return {}
        def normalize(self, raw): return []

    with pytest.raises(NotImplementedError):
        NoSource(mode="fixture")


def test_error_envelope_raises_with_api_message():
    with pytest.raises(RuntimeError, match="graph api error: Invalid OAuth access token"):
        raise_on_error_envelope(
            {"error": {"message": "Invalid OAuth access token", "code": 190}}, "graph api")


def test_non_error_body_passes_through_unchanged():
    body = {"data": [{"id": "1"}]}
    assert raise_on_error_envelope(body, "graph api") is body
