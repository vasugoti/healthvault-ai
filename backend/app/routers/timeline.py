"""
Timeline router: chronological event feed for the user.
"""
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.database import get_db
from app.models import TimelineEvent, User
from app.dependencies import get_current_user

router = APIRouter(prefix="/timeline", tags=["timeline"])


@router.get("", response_model=dict)
async def get_timeline(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    event_type: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the user's chronological health timeline."""
    from sqlalchemy import func
    try:
        page_val = int(page)
    except Exception:
        page_val = 1
    try:
        page_size_val = int(page_size)
    except Exception:
        page_size_val = 20

    query = select(TimelineEvent).where(TimelineEvent.user_id == current_user.id)

    if event_type:
        query = query.where(TimelineEvent.event_type == event_type)

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar()

    query = query.order_by(desc(TimelineEvent.occurred_at)).offset((page_val - 1) * page_size_val).limit(page_size_val)
    result = await db.execute(query)
    events = result.scalars().all()

    return {
        "items": [
            {
                "id": str(e.id),
                "event_type": e.event_type.value,
                "title": e.title,
                "description": e.description,
                "document_id": str(e.document_id) if e.document_id else None,
                "metric_id": str(e.metric_id) if e.metric_id else None,
                "metadata": e.event_metadata,
                "occurred_at": e.occurred_at.isoformat(),
            }
            for e in events
        ],
        "total": total,
        "page": page_val,
        "page_size": page_size_val,
        "pages": (total + page_size_val - 1) // page_size_val if page_size_val > 0 else 1,
    }
