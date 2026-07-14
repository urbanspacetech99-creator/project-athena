from athena.ai.llm import FakeLLM
from athena.ai.schemas import TitleSuggestions
from athena.features.research import suggest_titles


def test_suggest_titles_uses_llm(session):
    canned = TitleSuggestions(titles=["a", "b", "c", "d", "e"], prefill_prompt="Write about storage")
    out = suggest_titles(session, FakeLLM({TitleSuggestions: canned}),
                         source="internet_trends", context="k1, k2")
    assert out.titles == ["a", "b", "c", "d", "e"]
    assert out.prefill_prompt == "Write about storage"
