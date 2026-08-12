"""
Settings router: profile management, dashboard stats, data deletion.
"""
import logging
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from pydantic import BaseModel

from app.database import get_db
from app.models import User, Document, Metric, TimelineEvent, AIConversation, ProcessingStatus, VerificationStatus
from app.dependencies import get_current_user
from app.auth import hash_password, verify_password

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/settings", tags=["settings"])


class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    date_of_birth: Optional[str] = None
    sex: Optional[str] = None
    user_entered_conditions: Optional[list[str]] = None


class NotificationEmailUpdateRequest(BaseModel):
    notification_email: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.get("/profile")
async def get_profile(current_user: User = Depends(get_current_user)):
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "notification_email": current_user.notification_email,
        "effective_notification_email": current_user.notification_email or current_user.email,
        "full_name": current_user.full_name,
        "date_of_birth": current_user.date_of_birth.date().isoformat() if current_user.date_of_birth else None,
        "sex": current_user.sex,
        "user_entered_conditions": current_user.user_entered_conditions or [],
        "created_at": current_user.created_at.isoformat(),
    }


@router.patch("/profile")
async def update_profile(
    data: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if data.full_name is not None:
        current_user.full_name = data.full_name
    if data.date_of_birth is not None:
        try:
            current_user.date_of_birth = datetime.strptime(data.date_of_birth, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date_of_birth format")
    if data.sex is not None:
        current_user.sex = data.sex
    if data.user_entered_conditions is not None:
        current_user.user_entered_conditions = data.user_entered_conditions

    await db.commit()
    await db.refresh(current_user)
    return {"message": "Profile updated successfully"}


@router.patch("/notification-email")
async def update_notification_email(
    data: NotificationEmailUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Set or update custom email address for receiving health reminder notifications."""
    email_val = data.notification_email.strip() if data.notification_email else None
    if email_val and "@" not in email_val:
        raise HTTPException(status_code=400, detail="Invalid email address format")

    current_user.notification_email = email_val if email_val else None
    await db.commit()
    await db.refresh(current_user)
    return {
        "message": "Notification email updated successfully",
        "notification_email": current_user.notification_email,
        "effective_notification_email": current_user.notification_email or current_user.email,
    }


@router.post("/send-test-email")
async def trigger_test_email(
    current_user: User = Depends(get_current_user),
):
    """Send an immediate test email to verify SMTP configuration."""
    from app.email_service import send_test_email
    target_email = current_user.notification_email or current_user.email
    try:
        send_test_email(to_email=target_email, recipient_name=current_user.full_name)
        return {
            "message": f"Test email sent successfully to {target_email}",
            "target_email": target_email,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")



@router.post("/change-password")
async def change_password(
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(data.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(data.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")

    current_user.password_hash = hash_password(data.new_password)
    await db.commit()
    return {"message": "Password changed successfully"}


@router.get("/data-summary")
async def get_data_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Summary of all stored data — privacy transparency screen."""
    doc_count = (await db.execute(
        select(func.count()).where(Document.user_id == current_user.id)
    )).scalar()
    metric_count = (await db.execute(
        select(func.count()).where(Metric.user_id == current_user.id)
    )).scalar()
    verified_count = (await db.execute(
        select(func.count()).where(
            Metric.user_id == current_user.id,
            Metric.verification_status != VerificationStatus.UNVERIFIED,
        )
    )).scalar()
    conversation_count = (await db.execute(
        select(func.count()).where(AIConversation.user_id == current_user.id)
    )).scalar()
    timeline_count = (await db.execute(
        select(func.count()).where(TimelineEvent.user_id == current_user.id)
    )).scalar()

    return {
        "what_we_store": [
            {"category": "Documents", "count": doc_count, "description": "Medical reports and lab results you have uploaded"},
            {"category": "Health Metrics", "count": metric_count, "description": "Individual health values extracted from your documents"},
            {"category": "Verified Metrics", "count": verified_count, "description": "Values you have confirmed or edited"},
            {"category": "AI Conversations", "count": conversation_count, "description": "Your conversations with the AI assistant"},
            {"category": "Timeline Events", "count": timeline_count, "description": "A log of actions in your account"},
        ],
        "data_note": "All data is stored locally. No data is shared with third parties. AI responses are generated using Google Gemini — your health data is sent to Google's API for processing.",
        "account_created": current_user.created_at.isoformat(),
    }


@router.delete("/account", status_code=200)
async def delete_account(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Permanently delete the user's account and all associated data.
    Documents in MinIO are NOT automatically deleted by this route —
    the cascade will remove DB records, but storage cleanup is handled separately.
    """
    # Get all document storage paths before deletion
    docs_result = await db.execute(
        select(Document.storage_path).where(Document.user_id == current_user.id)
    )
    storage_paths = [row[0] for row in docs_result.all()]

    # Delete user (cascades to all related records via FK)
    await db.delete(current_user)
    await db.commit()

    # Cleanup storage files
    from app.storage import delete_file
    for path in storage_paths:
        try:
            delete_file(path)
        except Exception as e:
            logger.warning(f"Could not delete storage file {path}: {e}")

    return {"message": "Your account and all associated data have been permanently deleted."}
