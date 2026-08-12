"""
Metrics router: list all metrics, get metric time series, verify, edit.
Every metric shows its source document (provenance).
"""
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, asc
from pydantic import BaseModel

from app.database import get_db
from app.models import Metric, Document, TimelineEvent, TimelineEventType, VerificationStatus, ProcessingStatus, User
from app.dependencies import get_current_user
from app.utils import parse_iso_datetime_ist, is_future_date_ist

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/metrics", tags=["metrics"])


class MetricResponse(BaseModel):
    id: str
    metric_name: str
    metric_category: str
    value: float
    unit: str
    raw_value: str
    raw_unit: str
    measured_at: Optional[str]
    reference_range_low: Optional[float]
    reference_range_high: Optional[float]
    reference_range_unit: Optional[str]
    confidence_score: float
    verification_status: str
    verified_at: Optional[str]
    source_page: Optional[int]
    source_location: Optional[str]
    notes: Optional[str]
    document_id: str
    document_filename: Optional[str]
    created_at: str


class VerifyRequest(BaseModel):
    action: str  # "confirm" | "edit"
    value: Optional[float] = None
    unit: Optional[str] = None
    notes: Optional[str] = None


class CreateManualMetricRequest(BaseModel):
    metric_name: str
    metric_category: Optional[str] = "vital"
    value: float
    unit: str
    measured_at: Optional[str] = None  # ISO date string e.g. "2024-05-15" or ISO timestamp
    reference_range_low: Optional[float] = None
    reference_range_high: Optional[float] = None
    notes: Optional[str] = None


class UpdateMetricRequest(BaseModel):
    metric_name: Optional[str] = None
    metric_category: Optional[str] = None
    value: Optional[float] = None
    unit: Optional[str] = None
    measured_at: Optional[str] = None  # Allows changing the recorded date!
    reference_range_low: Optional[float] = None
    reference_range_high: Optional[float] = None
    notes: Optional[str] = None


def parse_iso_datetime(dt_str: Optional[str]) -> Optional[datetime]:
    return parse_iso_datetime_ist(dt_str)


class MetricSummary(BaseModel):
    metric_name: str
    metric_category: str
    latest_value: float
    latest_unit: str
    latest_measured_at: Optional[str]
    previous_value: Optional[float]
    change: Optional[float]
    change_pct: Optional[float]
    measurement_count: int
    first_measured_at: Optional[str]
    min_value: float
    max_value: float
    document_id: str  # Source of latest measurement


@router.get("", response_model=dict)
async def list_metrics(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    metric_name: Optional[str] = None,
    category: Optional[str] = None,
    verification_status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all metrics for the user, grouped by metric name with latest value."""
    # Subquery: get the latest measurement per metric name
    subq = (
        select(
            Metric.metric_name,
            func.max(Metric.measured_at).label("latest_at"),
        )
        .where(Metric.user_id == current_user.id)
        .group_by(Metric.metric_name)
        .subquery()
    )

    query = (
        select(
            Metric,
            func.count(Metric.id).over(partition_by=Metric.metric_name).label("count"),
        )
        .join(subq, (Metric.metric_name == subq.c.metric_name) & (Metric.measured_at == subq.c.latest_at))
        .where(Metric.user_id == current_user.id)
    )

    if metric_name:
        query = query.where(Metric.metric_name.ilike(f"%{metric_name}%"))
    if category:
        query = query.where(Metric.metric_category == category)
    if verification_status:
        query = query.where(Metric.verification_status == verification_status)

    result = await db.execute(query.order_by(Metric.metric_name))
    rows = result.all()

    return {
        "items": [_metric_response(row[0]) for row in rows],
        "total": len(rows),
    }


@router.get("/unverified", response_model=dict)
async def list_unverified_metrics(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all unverified metrics — feeds the Data Verification Center."""
    result = await db.execute(
        select(Metric)
        .where(
            Metric.user_id == current_user.id,
            Metric.verification_status == VerificationStatus.UNVERIFIED,
        )
        .order_by(asc(Metric.confidence_score), desc(Metric.created_at))
    )
    metrics = result.scalars().all()

    # Load document filenames
    doc_ids = list({m.document_id for m in metrics})
    docs_result = await db.execute(select(Document).where(Document.id.in_(doc_ids)))
    docs = {d.id: d for d in docs_result.scalars().all()}

    items = []
    for m in metrics:
        r = _metric_response(m)
        doc = docs.get(m.document_id)
        r["document_filename"] = doc.original_filename if doc else None
        items.append(r)

    return {"items": items, "total": len(items)}


@router.post("/manual", response_model=MetricResponse)
async def create_manual_metric(
    data: CreateManualMetricRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a manual health record with past date or live date."""
    doc_result = await db.execute(
        select(Document).where(
            Document.user_id == current_user.id,
            Document.original_filename == "Manual Entry",
        )
    )
    doc = doc_result.scalar_one_or_none()
    if not doc:
        doc = Document(
            id=uuid.uuid4(),
            user_id=current_user.id,
            original_filename="Manual Entry",
            storage_path=f"users/{current_user.id}/manual",
            mime_type="text/manual",
            processing_status=ProcessingStatus.READY,
        )
        db.add(doc)
        await db.flush()

    measured_at = parse_iso_datetime(data.measured_at) or datetime.now(timezone.utc)
    if is_future_date_ist(measured_at):
        raise HTTPException(status_code=400, detail="Health measurement date cannot be in the future.")

    low = data.reference_range_low
    high = data.reference_range_high
    if low is not None and high is not None and low > high:
        raise HTTPException(status_code=400, detail="Reference range low value cannot be greater than high value.")

    metric = Metric(
        id=uuid.uuid4(),
        user_id=current_user.id,
        document_id=doc.id,
        metric_name=data.metric_name.strip(),
        metric_category=data.metric_category.strip().lower() or "other",
        value=data.value,
        unit=data.unit.strip(),
        raw_value=str(data.value),
        raw_unit=data.unit.strip(),
        measured_at=measured_at,
        reference_range_low=data.reference_range_low,
        reference_range_high=data.reference_range_high,
        confidence_score=1.0,
        verification_status=VerificationStatus.VERIFIED,
        verified_at=datetime.now(timezone.utc),
        notes=data.notes,
    )
    db.add(metric)

    db.add(TimelineEvent(
        user_id=current_user.id,
        event_type=TimelineEventType.METRIC_VERIFIED,
        title=f"Manual health entry added: {metric.metric_name}",
        description=f"Value recorded: {metric.value} {metric.unit}",
        metric_id=metric.id,
        document_id=doc.id,
    ))

    await db.commit()
    await db.refresh(metric)
    return MetricResponse(**_metric_response(metric))


@router.get("/{metric_id}/series", response_model=dict)
async def get_metric_series(
    metric_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get the full time series for a metric name (based on the metric_id's name).
    Returns all measurements for this metric, oldest first.
    """
    # First get the metric to find its name
    metric = await _get_user_metric(metric_id, current_user.id, db)

    result = await db.execute(
        select(Metric)
        .where(Metric.user_id == current_user.id, Metric.metric_name == metric.metric_name)
        .order_by(asc(Metric.measured_at))
    )
    all_measurements = result.scalars().all()

    # Load source documents
    doc_ids = list({m.document_id for m in all_measurements})
    docs_result = await db.execute(select(Document).where(Document.id.in_(doc_ids)))
    docs = {d.id: d for d in docs_result.scalars().all()}

    items = []
    for m in all_measurements:
        r = _metric_response(m)
        doc = docs.get(m.document_id)
        r["document_filename"] = doc.original_filename if doc else None
        items.append(r)

    # Summary stats
    values = [m.value for m in all_measurements]
    return {
        "metric_name": metric.metric_name,
        "metric_category": metric.metric_category,
        "unit": metric.unit,
        "measurements": items,
        "summary": {
            "count": len(values),
            "first_measured_at": all_measurements[0].measured_at.isoformat() if all_measurements else None,
            "latest_measured_at": all_measurements[-1].measured_at.isoformat() if all_measurements else None,
            "min_value": min(values) if values else None,
            "max_value": max(values) if values else None,
            "first_value": values[0] if values else None,
            "latest_value": values[-1] if values else None,
        },
    }


@router.post("/{metric_id}/verify", response_model=MetricResponse)
async def verify_metric(
    metric_id: uuid.UUID,
    data: VerifyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Confirm or edit an extracted metric value."""
    metric = await _get_user_metric(metric_id, current_user.id, db)

    if data.action == "confirm":
        metric.verification_status = VerificationStatus.VERIFIED
        metric.verified_at = datetime.now(timezone.utc)

    elif data.action == "edit":
        if data.value is not None:
            metric.value = data.value
        if data.unit is not None:
            metric.unit = data.unit
        if data.notes is not None:
            metric.notes = data.notes
        metric.verification_status = VerificationStatus.EDITED
        metric.verified_at = datetime.now(timezone.utc)
    else:
        raise HTTPException(status_code=400, detail="action must be 'confirm' or 'edit'")

    # Update document verified count
    doc_result = await db.execute(select(Document).where(Document.id == metric.document_id))
    doc = doc_result.scalar_one_or_none()
    if doc:
        doc.verified_values_count = (doc.verified_values_count or 0) + 1

    db.add(TimelineEvent(
        user_id=current_user.id,
        event_type=TimelineEventType.METRIC_VERIFIED,
        title=f"Metric verified: {metric.metric_name}",
        description=f"Value confirmed: {metric.value} {metric.unit}",
        metric_id=metric_id,
        document_id=metric.document_id,
    ))

    await db.commit()
    await db.refresh(metric)
    return MetricResponse(**_metric_response(metric))


@router.patch("/{metric_id}", response_model=MetricResponse)
async def update_metric(
    metric_id: uuid.UUID,
    data: UpdateMetricRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing health record, including changing the measurement date."""
    metric = await _get_user_metric(metric_id, current_user.id, db)

    if data.metric_name is not None:
        metric.metric_name = data.metric_name.strip()
    if data.metric_category is not None:
        metric.metric_category = data.metric_category.strip().lower()
    if data.value is not None:
        metric.value = data.value
        metric.raw_value = str(data.value)
    if data.unit is not None:
        metric.unit = data.unit.strip()
        metric.raw_unit = data.unit.strip()
    if data.measured_at is not None:
        new_measured_at = parse_iso_datetime(data.measured_at)
        if is_future_date_ist(new_measured_at):
            raise HTTPException(status_code=400, detail="Health measurement date cannot be in the future.")
        metric.measured_at = new_measured_at
    if data.reference_range_low is not None:
        metric.reference_range_low = data.reference_range_low
    if data.reference_range_high is not None:
        metric.reference_range_high = data.reference_range_high

    target_low = metric.reference_range_low
    target_high = metric.reference_range_high
    if target_low is not None and target_high is not None and target_low > target_high:
        raise HTTPException(status_code=400, detail="Reference range low value cannot be greater than high value.")
    if data.notes is not None:
        metric.notes = data.notes

    metric.verification_status = VerificationStatus.EDITED
    metric.verified_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(metric)
    return MetricResponse(**_metric_response(metric))


@router.delete("/{metric_id}", status_code=204)
async def delete_metric(
    metric_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a metric entry."""
    metric = await _get_user_metric(metric_id, current_user.id, db)
    await db.delete(metric)
    await db.commit()


async def _get_user_metric(metric_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession) -> Metric:
    result = await db.execute(
        select(Metric).where(Metric.id == metric_id, Metric.user_id == user_id)
    )
    m = result.scalar_one_or_none()
    if not m:
        raise HTTPException(status_code=404, detail="Metric not found")
    return m


def _metric_response(m: Metric) -> dict:
    return {
        "id": str(m.id),
        "metric_name": m.metric_name,
        "metric_category": m.metric_category,
        "value": m.value,
        "unit": m.unit,
        "raw_value": m.raw_value,
        "raw_unit": m.raw_unit,
        "measured_at": m.measured_at.isoformat() if m.measured_at else None,
        "reference_range_low": m.reference_range_low,
        "reference_range_high": m.reference_range_high,
        "reference_range_unit": m.reference_range_unit,
        "confidence_score": m.confidence_score,
        "verification_status": m.verification_status.value,
        "verified_at": m.verified_at.isoformat() if m.verified_at else None,
        "source_page": m.source_page,
        "source_location": m.source_location,
        "notes": m.notes,
        "document_id": str(m.document_id),
        "document_filename": None,  # Filled in by callers that load the document
        "created_at": m.created_at.isoformat(),
    }
