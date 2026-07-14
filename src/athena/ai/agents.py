"""Runtime prompt resolution: agent system prompt + ordered skill fragments."""
from sqlalchemy.orm import Session

from athena.db.models import AgentDefinition, SkillDefinition
from athena.logging_setup import get_logger

log = get_logger("athena.ai.agents")


def resolve_agent_prompt(session: Session, key: str) -> str:
    """Compose the effective system prompt for agent `key` from the DB.

    Raises KeyError if the agent row is missing (the seed guarantees presence,
    so a miss means an unseeded/misconfigured database — fail loud).
    Dangling skill keys are skipped (with a warning log).
    """
    agent = session.query(AgentDefinition).filter_by(key=key).one_or_none()
    if agent is None:
        raise KeyError(f"agent definition not found: {key!r} (database not seeded?)")
    parts = [agent.system_prompt]
    if agent.skill_keys:
        by_key = {s.key: s.content for s in session.query(SkillDefinition)
                  .filter(SkillDefinition.key.in_(agent.skill_keys)).all()}
        missing = [k for k in agent.skill_keys if k not in by_key]
        if missing:
            log.warning("dangling skill keys", extra={"agent": key, "missing": missing})
        parts += [by_key[k] for k in agent.skill_keys if k in by_key]
    return "\n\n".join(parts)
