from athena.ai.schemas import AggregatedRecommendations, ImagePromptSpec, PostCaption


def test_post_caption_defaults():
    c = PostCaption()
    assert c.caption == "" and c.hashtags == []


def test_image_prompt_spec_defaults():
    s = ImagePromptSpec()
    assert s.prompt == "" and s.visual_style == ""


def test_aggregated_recommendations_defaults():
    r = AggregatedRecommendations()
    assert r.titles == [] and r.prefill_prompt == "" and r.rationale == ""


def test_default_fake_llm_registers_generate_schemas():
    from athena.ai.llm import default_fake_llm
    llm = default_fake_llm()
    cap = llm.structured("s", "u", PostCaption)
    assert isinstance(cap, PostCaption) and cap.caption
    spec = llm.structured("s", "u", ImagePromptSpec)
    assert isinstance(spec, ImagePromptSpec)
    rec = llm.structured("s", "u", AggregatedRecommendations)
    assert isinstance(rec, AggregatedRecommendations) and len(rec.titles) == 5
