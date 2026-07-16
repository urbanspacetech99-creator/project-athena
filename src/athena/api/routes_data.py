from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from athena.api import schemas
from athena.api.deps import get_session
from athena.db import models

router = APIRouter(prefix="/data", tags=["data"])


def _list(session, model, out_cls, limit, offset):
    total = session.query(model).count()
    rows = session.query(model).order_by(model.id).offset(offset).limit(limit).all()
    return schemas.ListResponse(items=[out_cls.model_validate(r) for r in rows], count=total)


@router.get("/own-posts", response_model=schemas.ListResponse[schemas.OwnPostOut],
            summary="List the team's own FB/IG posts with engagement metrics")
def own_posts(limit: int = 50, offset: int = 0, session: Session = Depends(get_session)):
    """Own published posts (Facebook + Instagram) with views, likes, and interactions."""
    return _list(session, models.OwnPost, schemas.OwnPostOut, limit, offset)


@router.get("/post-comments", response_model=schemas.ListResponse[schemas.PostCommentOut],
            summary="List comments on the team's own posts")
def post_comments(limit: int = 50, offset: int = 0, session: Session = Depends(get_session)):
    """Comments left by users on the team's own Facebook and Instagram posts."""
    return _list(session, models.PostComment, schemas.PostCommentOut, limit, offset)


@router.get("/competitor-posts", response_model=schemas.ListResponse[schemas.CompetitorPostOut],
            summary="List competitor public posts")
def competitor_posts(limit: int = 50, offset: int = 0, session: Session = Depends(get_session)):
    """Public posts published by tracked competitor pages, including like and comment counts."""
    return _list(session, models.CompetitorPost, schemas.CompetitorPostOut, limit, offset)


@router.get("/competitor-reviews", response_model=schemas.ListResponse[schemas.CompetitorReviewOut],
            summary="List competitor Google reviews")
def competitor_reviews(limit: int = 50, offset: int = 0, session: Session = Depends(get_session)):
    """Google reviews for tracked competitors (Google Places API), with the place-level
    rating and total review count denormalised onto each row."""
    return _list(session, models.CompetitorReview, schemas.CompetitorReviewOut, limit, offset)


@router.get("/google-reviews", response_model=schemas.ListResponse[schemas.GoogleReviewOut],
            summary="List Google Business reviews")
def google_reviews(limit: int = 50, offset: int = 0, session: Session = Depends(get_session)):
    """Google Business Profile reviews with star ratings and reviewer details."""
    return _list(session, models.GoogleReview, schemas.GoogleReviewOut, limit, offset)


@router.get("/keyword-volumes", response_model=schemas.ListResponse[schemas.KeywordVolumeOut],
            summary="List weekly keyword search volumes")
def keyword_volumes(limit: int = 50, offset: int = 0, session: Session = Depends(get_session)):
    """Weekly search-volume figures per keyword from Google Ads Keyword Planner."""
    return _list(session, models.KeywordVolume, schemas.KeywordVolumeOut, limit, offset)


@router.get("/zoho-chats", response_model=schemas.ListResponse[schemas.ZohoChatOut],
            summary="List ingested customer chat transcripts")
def zoho_chats(limit: int = 50, offset: int = 0, session: Session = Depends(get_session)):
    """Customer chat transcripts ingested from Zoho CRM."""
    return _list(session, models.ZohoChat, schemas.ZohoChatOut, limit, offset)
