from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from athena.ai.agents import resolve_agent_prompt
from athena.api import schemas
from athena.api.deps import get_session, get_settings
from athena.config import KNOWN_SOURCES, Settings
from athena.db.models import AgentDefinition, Competitor, SkillDefinition, TrackedKeyword
from athena.logging_setup import get_logger

log = get_logger("athena.api.config")

router = APIRouter(prefix="/config", tags=["config"])


# ---------------------------------------------------------------------------
# Modes
# ---------------------------------------------------------------------------

@router.get("/modes", response_model=schemas.ModesOut,
            summary="Effective live/fixture mode of every data source and AI client")
def modes(settings: Settings = Depends(get_settings)):
    """Which backing services are real: source adapters report live|fixture, AI
    clients report live|fake. Drives the dashboard's status badges. No secrets."""
    return {
        "sources": {s: settings.source_mode_for(s) for s in KNOWN_SOURCES},
        "ai": {"llm": settings.llm_mode, "image": settings.image_mode,
               "canva": settings.canva_mode},
    }


# ---------------------------------------------------------------------------
# Competitors
# ---------------------------------------------------------------------------

@router.get("/competitors", response_model=schemas.ListResponse[schemas.CompetitorOutRow],
            summary="List tracked competitors, optionally filtered by platform")
def list_competitors(platform: Literal["facebook", "instagram"] | None = None,
                     session: Session = Depends(get_session)):
    query = session.query(Competitor)
    if platform is not None:
        query = query.filter(Competitor.platform == platform)
    items = query.order_by(Competitor.platform, Competitor.name).all()
    return {"items": items, "count": len(items)}


@router.post("/competitors", response_model=schemas.CompetitorOutRow, status_code=201,
             summary="Add a tracked competitor")
def create_competitor(body: schemas.CompetitorIn, session: Session = Depends(get_session)):
    row = Competitor(platform=body.platform, name=body.name, external_id=body.external_id,
                     enabled=True)
    session.add(row)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=409,
                            detail="competitor with this platform and external_id already exists")
    session.refresh(row)
    log.info("competitor created", extra={"competitor_id": row.id, "platform": row.platform})
    return row


@router.patch("/competitors/{competitor_id}", response_model=schemas.CompetitorOutRow,
              summary="Update a tracked competitor")
def update_competitor(competitor_id: int, body: schemas.CompetitorUpdateIn,
                      session: Session = Depends(get_session)):
    row = session.get(Competitor, competitor_id)
    if row is None:
        raise HTTPException(status_code=404, detail="competitor not found")
    if body.name is not None:
        row.name = body.name
    if body.external_id is not None:
        row.external_id = body.external_id
    if body.enabled is not None:
        row.enabled = body.enabled
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=409,
                            detail="competitor with this platform and external_id already exists")
    session.refresh(row)
    log.info("competitor updated", extra={"competitor_id": competitor_id})
    return row


@router.delete("/competitors/{competitor_id}", status_code=204,
               summary="Remove a tracked competitor")
def delete_competitor(competitor_id: int, session: Session = Depends(get_session)):
    row = session.get(Competitor, competitor_id)
    if row is None:
        raise HTTPException(status_code=404, detail="competitor not found")
    session.delete(row)
    session.commit()
    log.info("competitor deleted", extra={"competitor_id": competitor_id})
    return Response(status_code=204)


# ---------------------------------------------------------------------------
# Keywords
# ---------------------------------------------------------------------------

@router.get("/keywords", response_model=schemas.ListResponse[schemas.TrackedKeywordOut],
            summary="List tracked keywords")
def list_keywords(session: Session = Depends(get_session)):
    items = session.query(TrackedKeyword).order_by(TrackedKeyword.keyword).all()
    return {"items": items, "count": len(items)}


@router.post("/keywords", response_model=schemas.TrackedKeywordOut, status_code=201,
             summary="Track a new keyword")
def create_keyword(body: schemas.KeywordIn, session: Session = Depends(get_session)):
    row = TrackedKeyword(keyword=body.keyword, enabled=True)
    session.add(row)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=409, detail="keyword already tracked")
    session.refresh(row)
    log.info("keyword created", extra={"keyword_id": row.id})
    return row


@router.patch("/keywords/{keyword_id}", response_model=schemas.TrackedKeywordOut,
              summary="Update a tracked keyword")
def update_keyword(keyword_id: int, body: schemas.KeywordUpdateIn,
                   session: Session = Depends(get_session)):
    row = session.get(TrackedKeyword, keyword_id)
    if row is None:
        raise HTTPException(status_code=404, detail="keyword not found")
    if body.keyword is not None:
        row.keyword = body.keyword
    if body.enabled is not None:
        row.enabled = body.enabled
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=409, detail="keyword already tracked")
    session.refresh(row)
    log.info("keyword updated", extra={"keyword_id": keyword_id})
    return row


@router.delete("/keywords/{keyword_id}", status_code=204,
               summary="Stop tracking a keyword")
def delete_keyword(keyword_id: int, session: Session = Depends(get_session)):
    row = session.get(TrackedKeyword, keyword_id)
    if row is None:
        raise HTTPException(status_code=404, detail="keyword not found")
    session.delete(row)
    session.commit()
    log.info("keyword deleted", extra={"keyword_id": keyword_id})
    return Response(status_code=204)


# ---------------------------------------------------------------------------
# Agents
# ---------------------------------------------------------------------------

@router.get("/agents", response_model=schemas.ListResponse[schemas.AgentOut],
            summary="List agent definitions")
def list_agents(session: Session = Depends(get_session)):
    items = session.query(AgentDefinition).order_by(AgentDefinition.key).all()
    return {"items": items, "count": len(items)}


@router.get("/agents/{key}", response_model=schemas.AgentOut,
            summary="Get an agent definition")
def get_agent(key: str, session: Session = Depends(get_session)):
    row = session.query(AgentDefinition).filter_by(key=key).one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="agent not found")
    return row


@router.patch("/agents/{key}", response_model=schemas.AgentOut,
              summary="Update an agent's system prompt and/or attached skills")
def update_agent(key: str, body: schemas.AgentUpdateIn, session: Session = Depends(get_session)):
    row = session.query(AgentDefinition).filter_by(key=key).one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="agent not found")
    if body.skill_keys is not None:
        skill_keys = list(dict.fromkeys(body.skill_keys))  # dedupe, order-preserving
        known = {s.key for s in session.query(SkillDefinition)
                 .filter(SkillDefinition.key.in_(skill_keys)).all()}
        unknown = [k for k in skill_keys if k not in known]
        if unknown:
            raise HTTPException(status_code=422, detail=f"unknown skill keys: {unknown}")
        row.skill_keys = skill_keys
    if body.system_prompt is not None:
        row.system_prompt = body.system_prompt
    session.commit()
    session.refresh(row)
    log.info("agent updated", extra={"agent_key": key})
    return row


@router.get("/agents/{key}/effective-prompt", response_model=schemas.EffectivePromptOut,
            summary="Resolve an agent's effective system prompt (prompt + attached skills)")
def get_effective_prompt(key: str, session: Session = Depends(get_session)):
    row = session.query(AgentDefinition).filter_by(key=key).one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="agent not found")
    return {"key": key, "effective_prompt": resolve_agent_prompt(session, key)}


# ---------------------------------------------------------------------------
# Skills
# ---------------------------------------------------------------------------

@router.get("/skills", response_model=schemas.ListResponse[schemas.SkillOut],
            summary="List skill fragments")
def list_skills(session: Session = Depends(get_session)):
    items = session.query(SkillDefinition).order_by(SkillDefinition.key).all()
    return {"items": items, "count": len(items)}


@router.post("/skills", response_model=schemas.SkillOut, status_code=201,
             summary="Create a new skill fragment")
def create_skill(body: schemas.SkillIn, session: Session = Depends(get_session)):
    if session.query(SkillDefinition).filter_by(key=body.key).one_or_none() is not None:
        raise HTTPException(status_code=409, detail="skill key already exists")
    row = SkillDefinition(key=body.key, name=body.name, content=body.content)
    session.add(row)
    try:
        session.commit()
    except IntegrityError:  # backstop for the pre-check's TOCTOU race
        session.rollback()
        raise HTTPException(status_code=409, detail="skill key already exists")
    session.refresh(row)
    log.info("skill created", extra={"skill_key": row.key})
    return row


@router.patch("/skills/{key}", response_model=schemas.SkillOut,
              summary="Update a skill fragment")
def update_skill(key: str, body: schemas.SkillUpdateIn, session: Session = Depends(get_session)):
    row = session.query(SkillDefinition).filter_by(key=key).one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="skill not found")
    if body.name is not None:
        row.name = body.name
    if body.content is not None:
        row.content = body.content
    session.commit()
    session.refresh(row)
    log.info("skill updated", extra={"skill_key": key})
    return row


@router.delete("/skills/{key}", response_model=schemas.SkillDeleteOut,
               summary="Delete a skill fragment and detach it from every agent")
def delete_skill(key: str, session: Session = Depends(get_session)):
    row = session.query(SkillDefinition).filter_by(key=key).one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="skill not found")
    detached_from: list[str] = []
    for agent in session.query(AgentDefinition).all():
        if key in agent.skill_keys:
            agent.skill_keys = [k for k in agent.skill_keys if k != key]
            detached_from.append(agent.key)
    session.delete(row)
    session.commit()
    log.info("skill deleted", extra={"skill_key": key, "detached_from": detached_from})
    return {"deleted": key, "detached_from": detached_from}
