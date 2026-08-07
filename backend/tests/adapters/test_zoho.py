import pytest

from athena.adapters.zoho import ZohoChatsAdapter


def test_normalize_zoho_chats():
    rows = ZohoChatsAdapter(mode="fixture").fetch_normalized()
    assert len(rows) == 12
    assert rows[0]["source_id"] == "7088917000002400001"
    assert "5x5 unit" in rows[0]["transcript"]
    wd = rows[0]["window_date"]
    assert (wd.year, wd.month, wd.day) == (2026, 7, 12)
    assert wd.tzinfo is not None   # +08:00 offset preserved


def test_normalize_coerces_null_transcript_to_empty_string():
    """Live Zoho (Call_Logs) returns the transcript field with a JSON null for empty records;
    normalize must yield "" (not None) so the DB row + downstream features stay string-typed."""
    ad = ZohoChatsAdapter(mode="fixture")   # default field is now "Transcript_Text"
    raw = {"data": [{"id": "1", "Transcript_Text": None,
                     "Created_Time": "2026-07-01T10:00:00+08:00"}]}
    rows = ad.normalize(raw)
    assert rows[0]["transcript"] == ""


def test_transcript_field_is_config_driven():
    from athena.config import Settings
    s = Settings()
    s.zoho_transcript_field = "Call_Summary"   # read a different Call_Logs field instead
    rows = ZohoChatsAdapter(mode="fixture", settings=s).fetch_normalized()
    assert rows[0]["transcript"] == "Pricing enquiry for a 5x5 storage unit."


class FakeTokenResp:
    def raise_for_status(self):
        pass

    def json(self):
        return {"access_token": "tok", "api_domain": "https://www.zohoapis.com"}


def _stub_live(monkeypatch, body, status_code=200):
    """Point fetch_live's two HTTP calls at a canned token and record-fetch response."""
    import httpx

    class FakeRecordsResp:
        def __init__(self):
            self.status_code = status_code

        def json(self):
            return body

    monkeypatch.setattr(httpx.Client, "post", lambda self, *a, **k: FakeTokenResp())
    monkeypatch.setattr(httpx.Client, "get", lambda self, *a, **k: FakeRecordsResp())


def test_fetch_live_raises_on_error_envelope(monkeypatch):
    """A generic {"error": {...}} body from the record-fetch call must raise, not
    silently normalize to zero chats -- proves the raise_on_error_envelope call-site
    wiring, not just the helper itself."""
    from athena.config import Settings

    _stub_live(monkeypatch, {"error": {"code": "INVALID_TOKEN",
                                       "message": "invalid oauth token"}})

    adapter = ZohoChatsAdapter(mode="live", settings=Settings())
    with pytest.raises(RuntimeError, match="zoho crm api"):
        adapter.fetch_live()


def test_fetch_live_raises_on_zoho_status_error(monkeypatch):
    """Zoho's own failure shape carries no top-level "error" key. Left unchecked it
    normalized to zero rows and reported a SUCCESSFUL ingest, which is how a deleted
    ZOHO_MODULE stayed invisible. The module name must reach the message."""
    from athena.config import Settings

    _stub_live(monkeypatch, {"code": "INVALID_MODULE", "status": "error",
                             "details": {"resource_path_index": 0},
                             "message": "the module name given seems to be invalid"},
               status_code=400)

    adapter = ZohoChatsAdapter(mode="live", settings=Settings(_env_file=None,
                                                              zoho_module="Call_Logs"))
    with pytest.raises(RuntimeError, match="INVALID_MODULE.*Call_Logs"):
        adapter.fetch_live()


def test_fetch_live_treats_204_as_no_records(monkeypatch):
    """A module with no records answers 204 with an empty body -- .json() cannot parse
    that, so the status has to be read before the body."""
    from athena.config import Settings

    def _explode():
        raise ValueError("no body to decode")

    _stub_live(monkeypatch, None, status_code=204)
    import httpx
    monkeypatch.setattr(httpx.Client, "get", lambda self, *a, **k: type(
        "R", (), {"status_code": 204, "json": staticmethod(_explode)})())

    adapter = ZohoChatsAdapter(mode="live", settings=Settings())
    assert adapter.fetch_live() == {"data": []}
    assert adapter.normalize(adapter.fetch_live()) == []
