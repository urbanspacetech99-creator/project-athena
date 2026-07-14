from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from athena.api import schemas
from athena.api.deps import get_canva_client, get_image_client, get_llm, get_session
from athena.features import aggregate, drafts, generate

router = APIRouter(prefix="/generate", tags=["generate"])


@router.post("/post", response_model=schemas.GeneratePostOut,
             summary="Generate 3 post options (caption + image + Canva edit link)")
def generate_post(body: schemas.GeneratePostIn, session: Session = Depends(get_session),
                  llm=Depends(get_llm), image_client=Depends(get_image_client),
                  canva=Depends(get_canva_client)):
    """Feature 8: caption -> image-prompt -> image chain, run 3x, each uploaded to Canva."""
    return generate.generate_post(session, llm, image_client, canva,
                                  body.model_dump(), options=body.options)


@router.post("/drafts", response_model=schemas.DraftOut,
             summary="Save a draft post")
def create_draft(body: schemas.DraftIn, session: Session = Depends(get_session)):
    return drafts.create_draft(session, platform=body.platform, caption=body.caption,
                               image_b64=body.image_b64, canva_edit_url=body.canva_edit_url)


@router.get("/drafts", response_model=schemas.ListResponse[schemas.DraftOut],
            summary="List saved drafts")
def list_drafts(session: Session = Depends(get_session)):
    items = drafts.list_drafts(session)
    return {"items": items, "count": len(items)}


@router.get("/drafts/{draft_id}", response_model=schemas.DraftOut,
            summary="Get a saved draft")
def get_draft(draft_id: int, session: Session = Depends(get_session)):
    draft = drafts.get_draft(session, draft_id)
    if draft is None:
        raise HTTPException(status_code=404, detail="draft not found")
    return draft


@router.patch("/drafts/{draft_id}", response_model=schemas.DraftOut,
              summary="Edit a saved draft's text")
def update_draft(draft_id: int, body: schemas.DraftUpdateIn,
                 session: Session = Depends(get_session)):
    draft = drafts.update_draft(session, draft_id, caption=body.caption, platform=body.platform)
    if draft is None:
        raise HTTPException(status_code=404, detail="draft not found")
    return draft


@router.delete("/drafts/{draft_id}", status_code=204,
               summary="Delete a saved draft")
def delete_draft(draft_id: int, session: Session = Depends(get_session)):
    if not drafts.delete_draft(session, draft_id):
        raise HTTPException(status_code=404, detail="draft not found")
    return Response(status_code=204)


@router.get("/recommendations", response_model=schemas.RecommendationsOut,
            summary="Aggregated cross-source recommendations (5 titles + prefill)")
def recommendations(session: Session = Depends(get_session), llm=Depends(get_llm)):
    """Feature 10: fan-out supervisor across all research sources, synthesised."""
    return aggregate.aggregated_recommendations(session, llm)
