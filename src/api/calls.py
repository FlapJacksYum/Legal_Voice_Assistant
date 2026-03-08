"""
GET /api/calls — list redacted intake call records for attorney review.
Supports pagination and filters (date range, legal-questions-flagged).
"""
from datetime import date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from src.api.auth import verify_api_key
from src.database import get_db
from src.models import IntakeCall

router = APIRouter(prefix="/api", tags=["calls"])


def _serialize_call(row: IntakeCall) -> dict:
    """Convert IntakeCall to API response shape with ISO datetimes."""
    return {
        "call_id": str(row.call_id),
        "start_time": (
            row.start_time.isoformat() + "Z"
            if row.start_time and hasattr(row.start_time, "isoformat")
            else None
        ),
        "end_time": (
            row.end_time.isoformat() + "Z"
            if row.end_time and hasattr(row.end_time, "isoformat")
            else None
        ),
        "redacted_transcript": row.redacted_transcript,
        "client_name_provided": row.client_name_provided,
        "debt_details_summary": row.debt_details_summary,
        "income_details_summary": row.income_details_summary,
        "asset_details_summary": row.asset_details_summary,
        "specific_legal_questions_flagged": bool(row.specific_legal_questions_flagged),
        "flagged_questions_summary": row.flagged_questions_summary,
    }


@router.get("/calls")
def list_calls(
    _api_key: Annotated[str, Depends(verify_api_key)],
    db: Annotated[Session, Depends(get_db)],
    limit: Annotated[int, Query(ge=1, le=100, description="Max records to return")] = 50,
    offset: Annotated[int, Query(ge=0, description="Records to skip")] = 0,
    since: Annotated[
        date | None,
        Query(description="Return only calls with start_time on or after this date (ISO 8601)"),
    ] = None,
    until: Annotated[
        date | None,
        Query(description="Return only calls with start_time on or before this date (ISO 8601)"),
    ] = None,
    flagged: Annotated[
        bool | None,
        Query(description="If true, only flagged; if false, only unflagged; omit for all"),
    ] = None,
) -> dict:
    """
    Retrieve redacted intake call records for attorney review.
    Results are paginated; optional filters: since, until, flagged.
    """
    q = select(IntakeCall)
    count_q = select(func.count()).select_from(IntakeCall)

    if since is not None:
        # start_time >= since at start of day
        since_dt = datetime.combine(since, datetime.min.time())
        q = q.where(IntakeCall.start_time >= since_dt)
        count_q = count_q.where(IntakeCall.start_time >= since_dt)
    if until is not None:
        # start_time <= until at end of day
        until_dt = datetime.combine(until, datetime.max.time())
        q = q.where(IntakeCall.start_time <= until_dt)
        count_q = count_q.where(IntakeCall.start_time <= until_dt)
    if flagged is not None:
        q = q.where(IntakeCall.specific_legal_questions_flagged == flagged)
        count_q = count_q.where(IntakeCall.specific_legal_questions_flagged == flagged)

    total = db.scalar(count_q) or 0
    q = q.order_by(IntakeCall.start_time.desc()).offset(offset).limit(limit)
    rows = list(db.scalars(q).all())

    return {
        "calls": [_serialize_call(r) for r in rows],
        "total": total,
    }
