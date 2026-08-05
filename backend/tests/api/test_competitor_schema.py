import pytest
from pydantic import ValidationError
from athena.api.schemas import CompetitorIn


def test_competitor_in_accepts_valid_name():
    c = CompetitorIn(platform="facebook", name="UrbanCo")
    assert c.name == "UrbanCo"


def test_competitor_in_rejects_empty_name():
    with pytest.raises(ValidationError):
        CompetitorIn(platform="facebook", name="")
