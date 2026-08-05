import json
from pathlib import Path

from athena.adapters.parity import assert_same_shape

ROOT = Path(__file__).resolve().parents[2]


def test_canva_asset_upload_fixture_matches_documented_shape():
    reference = {"job": {"id": "x", "status": "success",
                         "asset": {"id": "a", "name": "n", "tags": [],
                                   "created_at": 0, "updated_at": 0}}}
    fixture = json.loads((ROOT / "src/athena/integrations/fixtures/canva_asset_upload.json").read_text())
    assert_same_shape(reference, fixture)


def test_canva_design_fixture_matches_documented_shape():
    reference = {"design": {"id": "d", "title": "t",
                            "urls": {"edit_url": "e", "view_url": "v"}}}
    fixture = json.loads((ROOT / "src/athena/integrations/fixtures/canva_design.json").read_text())
    assert_same_shape(reference, fixture)
