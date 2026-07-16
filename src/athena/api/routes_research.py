from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from athena.api import schemas
from athena.api.deps import get_llm, get_session
from athena.features import research

router = APIRouter(prefix="/research", tags=["research"])


@router.get("/internet-trends", response_model=schemas.TrendsOut,
            summary="Search-interest trends in self-storage keywords + 5 suggested titles")
def internet_trends(session: Session = Depends(get_session), llm=Depends(get_llm)):
    """Top keyword search volumes this week, with 5 AI post titles feeding the Generate handoff."""
    return research.research_internet_trends(session, llm)


@router.get("/customer-questions", response_model=schemas.QuestionsOut,
            summary="Customer questions pulled from Zoho chat history (no AI)")
def customer_questions(session: Session = Depends(get_session)):
    """Raw customer questions extracted from chat transcripts."""
    return research.extract_customer_questions(session)


@router.get("/customer-insights", response_model=schemas.CustomerInsightsResponse,
            summary="Monthly AI summary of customer chats + 5 suggested titles")
def customer_insights(session: Session = Depends(get_session), llm=Depends(get_llm)):
    """Top requested services/features/promotions from customer chats, with Generate handoff."""
    return research.customer_insights_summary(session, llm)


@router.get("/social-reviews", response_model=schemas.SocialResponse,
            summary="Social comments & Google reviews insights + 5 suggested titles")
def social_reviews(session: Session = Depends(get_session), llm=Depends(get_llm)):
    """Views, comment topics, and review aggregation, with Generate handoff."""
    return research.research_social_reviews(session, llm)


@router.get("/competitor", response_model=schemas.CompetitorResponse,
            summary="Competitor activity & recommendations + 5 suggested titles")
def competitor(competitor: str | None = None, session: Session = Depends(get_session),
               llm=Depends(get_llm)):
    """Per-competitor analysis (posts, comment signal, Google reviews) with Generate
    handoff. Omit `competitor` for a cross-competitor sample."""
    return research.research_competitor(session, llm, competitor=competitor)
