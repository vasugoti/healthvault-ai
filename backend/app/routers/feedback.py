"""
Feedback & Support router: submit user feedback, feature requests, bug reports, and query history.
"""

import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from pydantic import BaseModel

from app.database import get_db
from app.models import Feedback, User
from app.dependencies import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/feedback", tags=["feedback"])


class CreateFeedbackRequest(BaseModel):
    feedback_type: str = "general"
    rating: Optional[int] = None
    subject: str
    message: str


class FeedbackResponse(BaseModel):
    id: str
    feedback_type: str
    rating: Optional[int]
    subject: str
    message: str
    status: str
    created_at: str

    class Config:
        from_attributes = True


def to_response(fb: Feedback) -> dict:
    return {
        "id": str(fb.id),
        "feedback_type": fb.feedback_type,
        "rating": fb.rating,
        "subject": fb.subject,
        "message": fb.message,
        "status": fb.status,
        "created_at": fb.created_at.isoformat() if fb.created_at else "",
    }


@router.post("", response_model=FeedbackResponse, status_code=201)
@router.post("/", response_model=FeedbackResponse, status_code=201)
async def submit_feedback(
    req: CreateFeedbackRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not req.subject.strip():
        raise HTTPException(status_code=400, detail="Subject is required.")
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Message detail is required.")
    if req.rating is not None and not (1 <= req.rating <= 5):
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5 stars.")

    fb = Feedback(
        id=uuid.uuid4(),
        user_id=current_user.id,
        feedback_type=req.feedback_type.lower().strip() or "general",
        rating=req.rating,
        subject=req.subject.strip(),
        message=req.message.strip(),
        status="open",
    )
    db.add(fb)
    await db.commit()
    await db.refresh(fb)

    return to_response(fb)


@router.get("", response_model=List[FeedbackResponse])
@router.get("/", response_model=List[FeedbackResponse])
async def list_user_feedback(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        select(Feedback)
        .where(Feedback.user_id == current_user.id)
        .order_by(desc(Feedback.created_at))
    )
    res = await db.execute(query)
    return [to_response(fb) for fb in res.scalars().all()]
