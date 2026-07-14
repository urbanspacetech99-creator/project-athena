import pytest
from pydantic import BaseModel
from athena.ai.llm import FakeLLM, get_llm
from athena.config import Settings


class Demo(BaseModel):
    label: str
    score: int


def test_fake_llm_returns_registered_instance():
    canned = Demo(label="x", score=1)
    llm = FakeLLM({Demo: canned})
    assert llm.structured("sys", "user", Demo) is canned


def test_fake_llm_unregistered_schema_raises():
    with pytest.raises(KeyError):
        FakeLLM({}).structured("s", "u", Demo)


def test_get_llm_defaults_to_fake():
    s = Settings()
    llm = get_llm(s)
    assert isinstance(llm, FakeLLM)


def test_get_llm_live_returns_anthropic():
    from athena.ai.llm import AnthropicLLM
    llm = get_llm(Settings(llm_mode="live", claude_api_key="k"))
    assert isinstance(llm, AnthropicLLM)
