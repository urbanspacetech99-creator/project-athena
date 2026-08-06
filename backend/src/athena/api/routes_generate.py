import json
from collections.abc import Iterable, Iterator

from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from athena.api import schemas
from athena.api.deps import get_canva_client, get_image_client, get_llm, get_session
from athena.features import aggregate, drafts, generate
from athena.logging_setup import get_logger

log = get_logger("athena.api.generate")

router = APIRouter(prefix="/generate", tags=["generate"])

_NDJSON = "application/x-ndjson"


def _ndjson(events: Iterable[dict]) -> Iterator[str]:
    """Serialize event dicts to NDJSON lines. A mid-stream exception becomes a terminal
    error event — the 200 status is already on the wire by then."""
    try:
        # default=str is a safety net for non-JSON values; every event field is a
        # plain str/list[str] today, so it should never actually fire.
        for event in events:
            yield json.dumps(event, default=str) + "\n"
    except Exception:
        log.exception("stream failed")
        yield json.dumps({"event": "error",
                          "detail": "an internal error occurred while streaming results"}) + "\n"


@router.post("/post", response_model=schemas.GeneratePostOut,
             summary="Generate 3 post options (caption + image + Canva edit link)")
def generate_post(body: schemas.GeneratePostIn, session: Session = Depends(get_session),
                  llm=Depends(get_llm), image_client=Depends(get_image_client),
                  canva=Depends(get_canva_client)):
    """Feature 8: caption -> image-prompt -> image chain, run 3x, each uploaded to Canva."""
    return generate.generate_post(session, llm, image_client, canva,
                                  body.model_dump(), options=body.options)


@router.post("/post/stream",
             summary="Generate post options, streaming NDJSON progress events",
             response_description="NDJSON: progress events, then one result event")
def generate_post_stream(body: schemas.GeneratePostIn, session: Session = Depends(get_session),
                         llm=Depends(get_llm), image_client=Depends(get_image_client),
                         canva=Depends(get_canva_client)):
    """Streaming variant of POST /generate/post. One JSON object per line:
    `{"event":"progress","step":n,"total":options*4,"label":"…"}` per completed step,
    then `{"event":"result","data":…}` (same shape as /generate/post), or
    `{"event":"error","detail":"…"}` on failure."""
    events = generate.generate_post_stream(session, llm, image_client, canva,
                                           body.model_dump(), options=body.options)
    return StreamingResponse(_ndjson(events), media_type=_NDJSON,
                             headers={"X-Accel-Buffering": "no"})


@router.post("/drafts", response_model=schemas.DraftOut,
             summary="Save a draft post")
def create_draft(body: schemas.DraftIn, session: Session = Depends(get_session)):
    return drafts.create_draft(session, platform=body.platform, caption=body.caption,
                               image_b64=body.image_b64, canva_edit_url=body.canva_edit_url,
                               canva_design_id=body.canva_design_id)


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
              summary="Edit a saved draft's text or image")
def update_draft(draft_id: int, body: schemas.DraftUpdateIn,
                 session: Session = Depends(get_session)):
    try:
        draft = drafts.update_draft(session, draft_id, caption=body.caption, platform=body.platform,
                                    image_b64=body.image_b64)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
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


@router.get("/recommendations/stream",
            summary="Aggregated recommendations, streaming NDJSON progress events",
            response_description="NDJSON: progress events, then one result event")
def recommendations_stream(session: Session = Depends(get_session), llm=Depends(get_llm)):
    """Streaming variant of GET /generate/recommendations: one progress event per research
    analyst (4, parallel — order varies) + synthesis (1), then
    `{"event":"result","data":{titles,prefill_prompt,rationale}}`."""
    events = aggregate.aggregated_recommendations_stream(session, llm)
    return StreamingResponse(_ndjson(events), media_type=_NDJSON,
                             headers={"X-Accel-Buffering": "no"})


@router.post("/drafts/{draft_id}/fetch-canva", response_model=schemas.DraftOut,
             summary="Pull the current exported image from this draft's Canva design")
def fetch_canva_draft(draft_id: int, session: Session = Depends(get_session),
                      canva=Depends(get_canva_client)):
    try:
        draft = drafts.fetch_canva_image(session, draft_id, canva)
    except Exception as e:
        log.warning("canva fetch failed", extra={"draft_id": draft_id}, exc_info=True)
        raise HTTPException(status_code=502, detail=f"could not fetch from Canva: {e}") from e
    if draft is None:
        raise HTTPException(status_code=404, detail="draft not found")
    return draft

@router.post("/drafts/{draft_id}/canva-edit", response_model=schemas.DraftOut,
             summary="Open this draft's Canva design, recreating it if it was deleted")
def open_canva_draft(draft_id: int, session: Session = Depends(get_session),
                     canva=Depends(get_canva_client)):
    draft = drafts.open_canva_design(session, draft_id, canva)
    if draft is None:
        raise HTTPException(status_code=404, detail="draft not found")
    return draft

@router.post("/drafts/{draft_id}/push-canva", response_model=schemas.DraftOut,
             summary="Push this draft's current image to a new Canva design")
def push_canva_draft(draft_id: int, session: Session = Depends(get_session),
                     canva=Depends(get_canva_client)):
    try:
        draft = drafts.push_to_canva(session, draft_id, canva)
    except Exception as e:
        log.warning("canva push failed", extra={"draft_id": draft_id}, exc_info=True)
        raise HTTPException(status_code=502, detail=f"could not push to Canva: {e}") from e
    if draft is None:
        raise HTTPException(status_code=404, detail="draft not found")
    return draft