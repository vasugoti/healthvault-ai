"""
Search router: full-text search across documents and metrics.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func

from app.database import get_db
from app.models import Document, Metric, User, ProcessingStatus
from app.dependencies import get_current_user

router = APIRouter(prefix="/search", tags=["search"])


@router.get("", response_model=dict)
async def search(
    q: str = Query(..., min_length=1, max_length=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Full-text search across document names and metric names/values.
    MVP: Postgres ILIKE search. V3: Vector semantic search.
    """
    search_term = f"%{q}%"
    user_id = current_user.id

    # Search documents
    doc_result = await db.execute(
        select(Document)
        .where(
            Document.user_id == user_id,
            Document.processing_status == ProcessingStatus.READY,
            or_(
                Document.original_filename.ilike(search_term),
                Document.lab_name.ilike(search_term),
                Document.doctor_name.ilike(search_term),
                Document.document_type.cast(db.bind.dialect.type_descriptor(db.bind.dialect.colspecs.get(type(Document.document_type), type(None)))).ilike(search_term) if False else Document.original_filename.ilike(search_term),  # type fallback
            ),
        )
        .limit(10)
    )
    documents = doc_result.scalars().all()

    # Search metrics
    metric_result = await db.execute(
        select(Metric)
        .where(
            Metric.user_id == user_id,
            or_(
                Metric.metric_name.ilike(search_term),
                Metric.metric_category.ilike(search_term),
            ),
        )
        .limit(20)
    )
    metrics = metric_result.scalars().all()

    return {
        "query": q,
        "documents": [
            {
                "id": str(d.id),
                "original_filename": d.original_filename,
                "document_type": d.document_type.value if d.document_type else None,
                "report_date": d.report_date.date().isoformat() if d.report_date else None,
                "result_type": "document",
            }
            for d in documents
        ],
        "metrics": [
            {
                "id": str(m.id),
                "metric_name": m.metric_name,
                "value": m.value,
                "unit": m.unit,
                "measured_at": m.measured_at.isoformat() if m.measured_at else None,
                "document_id": str(m.document_id),
                "result_type": "metric",
            }
            for m in metrics
        ],
        "total_results": len(documents) + len(metrics),
    }
