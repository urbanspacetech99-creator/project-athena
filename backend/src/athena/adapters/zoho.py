import json
from datetime import datetime
from pathlib import Path

import httpx

from athena.adapters.base import SourceAdapter, raise_on_error_envelope
from athena.config import Settings

FIXTURE_DIR = Path(__file__).parent / "fixtures"


class ZohoChatsAdapter(SourceAdapter):
    source = "zoho"

    def __init__(self, mode, settings: Settings | None = None):
        super().__init__(mode)
        self.settings = settings or Settings()

    def _load(self, name: str):
        return json.loads((FIXTURE_DIR / name).read_text(encoding="utf-8"))

    def fetch_fixture(self, **kwargs):
        return self._load("zoho_chats.json")

    def fetch_live(self, **kwargs):
        s = self.settings
        dc = getattr(s, "zoho_dc", "com") or "com"
        module = getattr(s, "zoho_module", "Call_Logs")
        field = getattr(s, "zoho_transcript_field", "Transcript_Text")
        with httpx.Client(timeout=30) as c:
            tok_resp = c.post(f"https://accounts.zoho.{dc}/oauth/v2/token", data={
                "grant_type": "refresh_token",
                "refresh_token": getattr(s, "zoho_refresh_token", "") or "",
                "client_id": getattr(s, "zoho_client_id", "") or "",
                "client_secret": getattr(s, "zoho_client_secret", "") or "",
            })
            # token endpoint had no status check before; a failed refresh (bad/revoked
            # refresh token) must not silently pass an empty access_token downstream.
            tok_resp.raise_for_status()
            tok = tok_resp.json()
            access = tok.get("access_token", "")
            api_domain = tok.get("api_domain", f"https://www.zohoapis.{dc}")
            body = c.get(f"{api_domain}/crm/v6/{module}",
                         params={"fields": f"id,{field},Created_Time", "per_page": 200},
                         headers={"Authorization": f"Zoho-oauthtoken {access}"}).json()
        # Zoho CRM's actual error shape is {"code": ..., "message": ..., "status": "error"}
        # (no top-level "error" key), validated live 2026-07-10 -- see
        # docs/LIVE_API_VALIDATION.md row 7. raise_on_error_envelope only catches the
        # generic {"error": {...}} shape shared with the other adapters; that's intentional
        # here (keeps normal {"data": [...]} responses untouched) rather than hand-rolling
        # Zoho-specific error detection.
        return raise_on_error_envelope(body, "zoho crm api")

    def normalize(self, raw) -> list[dict]:
        field = getattr(self.settings, "zoho_transcript_field", "Transcript_Text")
        rows = []
        for rec in raw.get("data", []):
            rows.append({"source_id": rec["id"],
                         # coerce None -> "": Zoho includes the field with a null value
                         # for records where the transcript is empty (seen live in Call_Logs).
                         "transcript": rec.get(field) or "",
                         "window_date": datetime.fromisoformat(rec["Created_Time"])})
        return rows
