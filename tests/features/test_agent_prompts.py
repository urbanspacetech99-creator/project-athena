from datetime import datetime, timezone

from athena.ai.images import FakeImageClient
from athena.ai.llm import default_fake_llm
from athena.db.models import (AgentDefinition, CompetitorPost, GoogleReview, KeywordVolume,
                               OwnPost, ZohoChat)
from athena.features import research
from athena.features.aggregate import aggregated_recommendations
from athena.features.generate import generate_post
from athena.integrations.canva import FakeCanvaClient


class RecordingLLM:
    def __init__(self):
        self._inner = default_fake_llm()
        self.systems: list[str] = []

    def structured(self, system, user, schema):
        self.systems.append(system)
        return self._inner.structured(system, user, schema)


def test_suggest_titles_uses_db_prompt(session):
    agent = session.query(AgentDefinition).filter_by(key="title_suggester").one()
    agent.system_prompt = "CUSTOM TITLE PROMPT"
    session.commit()
    llm = RecordingLLM()
    research.suggest_titles(session, llm, "internet_trends", "ctx")
    assert llm.systems[0].startswith("CUSTOM TITLE PROMPT")


def test_competitor_research_uses_db_prompt(session):
    agent = session.query(AgentDefinition).filter_by(key="competitor_analyst").one()
    agent.system_prompt = "CUSTOM COMPETITOR PROMPT"
    session.commit()
    llm = RecordingLLM()
    research.research_competitor(session, llm)
    # first call = competitor analysis, second = title suggestion
    assert llm.systems[0].startswith("CUSTOM COMPETITOR PROMPT")


def test_generate_post_uses_db_prompts(session):
    caption_agent = session.query(AgentDefinition).filter_by(key="caption_writer").one()
    caption_agent.system_prompt = "CUSTOM CAPTION PROMPT"
    image_agent = session.query(AgentDefinition).filter_by(key="image_prompt_designer").one()
    image_agent.system_prompt = "CUSTOM IMAGE PROMPT"
    session.commit()

    llm = RecordingLLM()
    brief = {"platform": "instagram", "tone": "friendly", "length": "short",
             "prefill_prompt": "Promote climate-controlled units", "visual_style": "clean_product",
             "include_hashtags": True, "include_cta": True, "include_emoji": False,
             "include_pricing": False}
    generate_post(session, llm, FakeImageClient(), FakeCanvaClient(), brief)
    # each option runs caption then image_prompt; systems alternate per option
    assert llm.systems[0].startswith("CUSTOM CAPTION PROMPT")
    assert llm.systems[1].startswith("CUSTOM IMAGE PROMPT")


def test_aggregated_recommendations_uses_db_prompt(session):
    agent = session.query(AgentDefinition).filter_by(key="aggregator_synthesis").one()
    agent.system_prompt = "CUSTOM SYNTHESIS PROMPT"
    session.commit()

    now = datetime.now(timezone.utc)
    session.add(KeywordVolume(source_id="k1", window_date=now, keyword="self storage",
                              weekly_search_volume=100))
    session.add(OwnPost(source_id="p1", window_date=now, platform="instagram", title="t",
                        content="unit tour", views=50, likes=5, interactions=8))
    session.add(GoogleReview(source_id="r1", window_date=now, star_rating=5, comment="great",
                             reviewer="A"))
    session.add(CompetitorPost(source_id="c1", window_date=now, competitor="BoxCo", text="promo"))
    session.add(ZohoChat(source_id="z1", window_date=now, transcript="Customer: price?"))
    session.commit()

    llm = RecordingLLM()
    aggregated_recommendations(session, llm)
    # synthesis is the fan-in barrier node, so it is always the last recorded call
    assert llm.systems[-1].startswith("CUSTOM SYNTHESIS PROMPT")
