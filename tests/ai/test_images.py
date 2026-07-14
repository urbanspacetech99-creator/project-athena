import pytest

from athena.ai.images import (FakeImageClient, GeneratedImage, GeminiImageClient,
                              get_image_client, parse_gemini_image)
from athena.config import Settings


def test_fake_image_client_is_deterministic_and_keyless():
    img = FakeImageClient().generate("a clean self-storage unit, product style")
    assert isinstance(img, GeneratedImage)
    assert img.mime_type == "image/png"
    assert img.data_b64 and img.data_b64 == FakeImageClient().generate("other").data_b64


def test_parse_gemini_image():
    body = {"candidates": [{"content": {"parts": [
        {"inlineData": {"mimeType": "image/png", "data": "QUJD"}}]}}]}
    img = parse_gemini_image(body)
    assert img.data_b64 == "QUJD" and img.mime_type == "image/png"


def test_parse_gemini_image_empty_raises():
    with pytest.raises(ValueError, match="no image data"):
        parse_gemini_image({"candidates": []})


def test_parse_gemini_image_null_content_raises():
    with pytest.raises(ValueError, match="no image data"):
        parse_gemini_image({"candidates": [{"content": None, "finishReason": "SAFETY"}]})


def test_factory_fake_by_default():
    assert isinstance(get_image_client(Settings(image_mode="fake")), FakeImageClient)


def test_factory_live():
    client = get_image_client(Settings(image_mode="live", gemini_api_key="k"))
    assert isinstance(client, GeminiImageClient)
