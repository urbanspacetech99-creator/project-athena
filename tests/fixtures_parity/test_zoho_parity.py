from athena.adapters.parity import assert_same_shape
from athena.adapters.zoho import ZohoChatsAdapter


def test_zoho_fixture_matches_documented_shape():
    # Confirmed live 2026-07-10: Zoho CRM v6, custom module `Call_Logs`.
    reference = {"data": [{"id": "i", "Transcript_Text": "t", "Call_Summary": "s",
                           "Created_Time": "t"}],
                 "info": {"per_page": 200, "next_page_token": None, "count": 1, "sort_by": "id",
                          "page": 1, "previous_page_token": None, "page_token_expiry": None,
                          "sort_order": "desc", "more_records": False}}
    fixture = ZohoChatsAdapter(mode="fixture")._load("zoho_chats.json")
    assert_same_shape(reference, fixture)
