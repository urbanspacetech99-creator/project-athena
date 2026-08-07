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
            resp = c.get(f"{api_domain}/crm/v6/{module}",
                         params={"fields": f"id,{field},Created_Time", "per_page": 200},
                         headers={"Authorization": f"Zoho-oauthtoken {access}"})
        # "Module exists, holds no records" is a 204 with an empty body, which .json()
        # cannot parse. Genuinely empty, so answer with the empty result shape.
        if resp.status_code == 204:
            return {"data": []}
        body = resp.json()
        # Zoho CRM reports failure as {"code", "message", "status": "error"} with no
        # top-level "error" key (validated live 2026-07-10, see docs/LIVE_API_VALIDATION.md
        # row 7), so raise_on_error_envelope never saw it: a 400 normalized to zero rows and
        # the ingest reported success. That is how a deleted ZOHO_MODULE went unnoticed
        # until 2026-08-07. Name the failure; `code` is the actionable half (INVALID_MODULE,
        # REQUIRED_PARAM_MISSING, OAUTH_SCOPE_MISMATCH).
        if isinstance(body, dict) and body.get("status") == "error":
            raise RuntimeError(f"zoho crm api error: {body.get('code')} — "
                               f"{body.get('message')} (module={module!r}, field={field!r})")
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
