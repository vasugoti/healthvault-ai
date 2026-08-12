"""
Reminders router: list, add, update, complete, and delete health test reminders.
Supports recurring frequency advancement (days, weeks, months, years) and one-time date reminders.
"""
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, asc
from pydantic import BaseModel

from app.database import get_db
from app.models import Reminder, User
from app.dependencies import get_current_user
from app.utils import parse_iso_datetime_ist, is_future_date_ist, IST_TZ

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/reminders", tags=["reminders"])


class CreateReminderRequest(BaseModel):
    title: str
    category: str = "diabetes"
    reminder_type: str = "recurring"  # "recurring" | "one_time"
    frequency_value: Optional[int] = 2
    frequency_unit: Optional[str] = "months"  # "days" | "weeks" | "months" | "years"
    next_due_date: str
    notes: Optional[str] = None
    notify_before_days: Optional[int] = 1
    is_active: bool = True


class UpdateReminderRequest(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    reminder_type: Optional[str] = None
    frequency_value: Optional[int] = None
    frequency_unit: Optional[str] = None
    next_due_date: Optional[str] = None
    notes: Optional[str] = None
    notify_before_days: Optional[int] = None
    is_active: Optional[bool] = None


class ReminderResponse(BaseModel):
    id: str
    title: str
    category: str
    reminder_type: str
    frequency_value: Optional[int]
    frequency_unit: Optional[str]
    next_due_date: str
    last_completed_date: Optional[str]
    notes: Optional[str]
    notify_before_days: int = 1
    is_active: bool
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


def parse_iso_datetime(dt_str: Optional[str]) -> Optional[datetime]:
    return parse_iso_datetime_ist(dt_str)


def format_iso(dt: Optional[datetime]) -> Optional[str]:
    return dt.isoformat() if dt else None


def calculate_next_due_date(base_dt: datetime, val: int, unit: str) -> datetime:
    unit = (unit or "months").lower()
    val = max(1, val or 1)
    if unit in ("day", "days"):
        return base_dt + timedelta(days=val)
    elif unit in ("week", "weeks"):
        return base_dt + timedelta(weeks=val)
    elif unit in ("year", "years"):
        try:
            from dateutil.relativedelta import relativedelta
            return base_dt + relativedelta(years=val)
        except Exception:
            return base_dt.replace(year=base_dt.year + val)
    else:  # months default
        try:
            from dateutil.relativedelta import relativedelta
            return base_dt + relativedelta(months=val)
        except Exception:
            month = base_dt.month - 1 + val
            year = base_dt.year + month // 12
            month = month % 12 + 1
            day = min(base_dt.day, 28)
            return base_dt.replace(year=year, month=month, day=day)


def to_response(r: Reminder) -> ReminderResponse:
    return ReminderResponse(
        id=str(r.id),
        title=r.title,
        category=r.category,
        reminder_type=r.reminder_type,
        frequency_value=r.frequency_value,
        frequency_unit=r.frequency_unit,
        next_due_date=format_iso(r.next_due_date) or "",
        last_completed_date=format_iso(r.last_completed_date),
        notes=r.notes,
        notify_before_days=r.notify_before_days if r.notify_before_days is not None else 1,
        is_active=r.is_active,
        created_at=format_iso(r.created_at) or "",
        updated_at=format_iso(r.updated_at) or "",
    )


@router.get("", response_model=List[ReminderResponse])
async def list_reminders(
    is_active: Optional[bool] = Query(None),
    category: Optional[str] = Query(None),
    due_soon: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Reminder).where(Reminder.user_id == current_user.id)
    if is_active is not None and isinstance(is_active, bool):
        query = query.where(Reminder.is_active == is_active)
    elif isinstance(is_active, str):
        query = query.where(Reminder.is_active == (is_active.lower() == "true"))

    if category and isinstance(category, str):
        query = query.where(Reminder.category == category)

    if due_soon is True or (isinstance(due_soon, str) and due_soon.lower() == "true"):
        thirty_days_hence = datetime.now(timezone.utc) + timedelta(days=30)
        query = query.where(Reminder.next_due_date <= thirty_days_hence)

    query = query.order_by(asc(Reminder.next_due_date))
    result = await db.execute(query)
    reminders = result.scalars().all()
    return [to_response(r) for r in reminders]


@router.post("", response_model=ReminderResponse, status_code=201)
async def create_reminder(
    req: CreateReminderRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    due_dt = parse_iso_datetime(req.next_due_date) or datetime.now(timezone.utc)
    reminder = Reminder(
        id=uuid.uuid4(),
        user_id=current_user.id,
        title=req.title.strip(),
        category=req.category,
        reminder_type=req.reminder_type,
        frequency_value=req.frequency_value if req.reminder_type == "recurring" else None,
        frequency_unit=req.frequency_unit if req.reminder_type == "recurring" else None,
        next_due_date=due_dt,
        notes=req.notes.strip() if req.notes else None,
        notify_before_days=req.notify_before_days if req.notify_before_days is not None else 1,
        is_active=req.is_active,
    )
    db.add(reminder)
    await db.commit()
    await db.refresh(reminder)
    return to_response(reminder)


@router.get("/{reminder_id}", response_model=ReminderResponse)
async def get_reminder(
    reminder_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Reminder).where(
        Reminder.id == reminder_id,
        Reminder.user_id == current_user.id,
    )
    result = await db.execute(query)
    reminder = result.scalar_one_or_none()
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return to_response(reminder)


@router.patch("/{reminder_id}", response_model=ReminderResponse)
async def update_reminder(
    reminder_id: uuid.UUID,
    req: UpdateReminderRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Reminder).where(
        Reminder.id == reminder_id,
        Reminder.user_id == current_user.id,
    )
    result = await db.execute(query)
    reminder = result.scalar_one_or_none()
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")

    if req.title is not None:
        reminder.title = req.title.strip()
    if req.category is not None:
        reminder.category = req.category
    if req.reminder_type is not None:
        reminder.reminder_type = req.reminder_type
    if req.frequency_value is not None:
        reminder.frequency_value = req.frequency_value
    if req.frequency_unit is not None:
        reminder.frequency_unit = req.frequency_unit
    if req.next_due_date is not None:
        reminder.next_due_date = parse_iso_datetime(req.next_due_date) or reminder.next_due_date
    if req.notes is not None:
        reminder.notes = req.notes.strip() if req.notes else None
    if req.notify_before_days is not None:
        reminder.notify_before_days = req.notify_before_days
    if req.is_active is not None:
        reminder.is_active = req.is_active

    await db.commit()
    await db.refresh(reminder)
    return to_response(reminder)


@router.post("/{reminder_id}/complete", response_model=ReminderResponse)
async def complete_reminder(
    reminder_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Reminder).where(
        Reminder.id == reminder_id,
        Reminder.user_id == current_user.id,
    )
    result = await db.execute(query)
    reminder = result.scalar_one_or_none()
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")

    if is_future_date_ist(reminder.next_due_date):
        due_str = reminder.next_due_date.astimezone(IST_TZ).strftime("%b %d, %Y")
        raise HTTPException(
            status_code=400,
            detail=f"Cannot mark a future reminder as complete before its target test date ({due_str})."
        )

    now = datetime.now(timezone.utc)
    reminder.last_completed_date = now

    if reminder.reminder_type == "recurring":
        base_dt = reminder.next_due_date if reminder.next_due_date > now else now
        reminder.next_due_date = calculate_next_due_date(
            base_dt,
            reminder.frequency_value or 1,
            reminder.frequency_unit or "months",
        )

    await db.commit()
    await db.refresh(reminder)
    return to_response(reminder)


@router.delete("/{reminder_id}", status_code=204)
async def delete_reminder(
    reminder_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Reminder).where(
        Reminder.id == reminder_id,
        Reminder.user_id == current_user.id,
    )
    result = await db.execute(query)
    reminder = result.scalar_one_or_none()
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")

    await db.delete(reminder)
    await db.commit()
    return None
