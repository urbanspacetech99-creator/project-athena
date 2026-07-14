import pytest

from athena.ai.agents import resolve_agent_prompt
from athena.db.models import AgentDefinition, SkillDefinition


def test_resolves_prompt_with_skills_in_order(session):
    prompt = resolve_agent_prompt(session, "caption_writer")
    agent = session.query(AgentDefinition).filter_by(key="caption_writer").one()
    assert prompt.startswith(agent.system_prompt)
    contents = [session.query(SkillDefinition).filter_by(key=k).one().content
                for k in agent.skill_keys]
    assert prompt == "\n\n".join([agent.system_prompt] + contents)


def test_missing_agent_raises(session):
    with pytest.raises(KeyError, match="nonexistent"):
        resolve_agent_prompt(session, "nonexistent")


def test_dangling_skill_key_is_skipped(session):
    agent = session.query(AgentDefinition).filter_by(key="comment_insights").one()
    agent.skill_keys = ["brand-identity", "deleted-skill"]
    session.commit()
    prompt = resolve_agent_prompt(session, "comment_insights")
    assert "deleted-skill" not in prompt
    assert "Brand facts" in prompt
