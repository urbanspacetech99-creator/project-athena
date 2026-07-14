from fastapi import APIRouter, Depends, HTTPException

from athena.api import schemas
from athena.api.deps import get_session_factory, get_settings
from athena.config import Settings
from athena.ingestion.runner import IngestResult
from athena.jobs import ingestion_jobs

router = APIRouter(prefix="/ingest", tags=["ingestion"])

_JOBS = {
    "meta": ingestion_jobs.ingest_meta_posts,
    "competitor": ingestion_jobs.ingest_competitor_posts,
    "google_reviews": ingestion_jobs.ingest_google_reviews,
    "google_ads": ingestion_jobs.ingest_keyword_volumes,
    "zoho": ingestion_jobs.ingest_zoho_chats,
}


def _to_response(source: str, res) -> schemas.IngestResponse:
    inserted = updated = total = 0
    failed: list[str] = []
    if isinstance(res, IngestResult):
        inserted, updated, total = res.inserted, res.updated, res.total
    elif isinstance(res, dict):
        for k, v in res.items():
            if isinstance(v, IngestResult):
                inserted += v.inserted
                updated += v.updated
                total += v.total
            elif isinstance(v, int):
                total += v
            elif k == "failed" and isinstance(v, list):
                failed = v
    return schemas.IngestResponse(source=source, inserted=inserted, updated=updated,
                                  total=total, failed=failed)


@router.post("/{source}", response_model=schemas.IngestResponse,
             summary="Trigger ingestion for a source (in its configured live|fixture mode)")
def trigger_ingestion(source: str, factory=Depends(get_session_factory),
                      settings: Settings = Depends(get_settings)):
    """Run the ingestion job for `source` on demand. Valid sources:
    meta, competitor, google_reviews, google_ads, zoho."""
    if source not in _JOBS:
        raise HTTPException(status_code=400, detail=f"unknown source: {source}")
    res = _JOBS[source](factory, settings)
    return _to_response(source, res)
