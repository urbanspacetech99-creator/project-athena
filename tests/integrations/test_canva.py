import json
from pathlib import Path

import pytest

from athena.ai.images import GeneratedImage
from athena.config import Settings
import base64

from athena.integrations.canva import (CanvaHandoff, FakeCanvaClient, get_canva_client,
                                        parse_asset_id, parse_edit_url, upload_metadata_header)

ROOT = Path(__file__).resolve().parents[2]
UPLOAD = ROOT / "src/athena/integrations/fixtures/canva_asset_upload.json"
DESIGN = ROOT / "src/athena/integrations/fixtures/canva_design.json"


def test_parse_asset_id_from_documented_shape():
    assert parse_asset_id(json.loads(UPLOAD.read_text())) == "Msd59349ff"


def test_parse_edit_url_from_documented_shape():
    assert parse_edit_url(json.loads(DESIGN.read_text())) == \
        "https://www.canva.com/design/DAFVztcvd9z/edit"


def test_parse_asset_id_raises_on_incomplete_job():
    with pytest.raises(ValueError):
        parse_asset_id({"job": {"status": "in_progress"}})


def test_parse_edit_url_raises_on_missing_urls():
    with pytest.raises(ValueError):
        parse_edit_url({"design": {}})


def test_upload_metadata_header_base64_encodes_the_name_string():
    """Confirmed live 2026-07-10: name_base64 must be base64 of the NAME string itself
    (not base64 of a JSON object), and the name is capped at 50 chars."""
    header = json.loads(upload_metadata_header("instagram-1"))
    assert base64.b64decode(header["name_base64"]).decode() == "instagram-1"
    long_header = json.loads(upload_metadata_header("x" * 80))
    assert base64.b64decode(long_header["name_base64"]).decode() == "x" * 50


def test_fake_canva_client_returns_deterministic_handoff_keyless():
    img = GeneratedImage(mime_type="image/png", data_b64="QUJD")
    a = FakeCanvaClient().upload_and_edit_url(img, title="post")
    b = FakeCanvaClient().upload_and_edit_url(img, title="post")
    assert isinstance(a, CanvaHandoff)
    assert a.asset_id and a.edit_url.startswith("https://www.canva.com/design/")
    assert a == b


def test_get_canva_client_defaults_to_fake():
    assert isinstance(get_canva_client(Settings()), FakeCanvaClient)
