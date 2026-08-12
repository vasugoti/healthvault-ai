"""
Documents router: upload, list, get details, get presigned URL, delete.
"""
import uuid
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.models import (
    Document, ProcessingJob, ProcessingStatus, TimelineEvent, TimelineEventType
)
from app.dependencies import get_current_user
from app.models import User
from app.storage import upload_file, get_presigned_url, delete_file

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/documents", tags=["documents"])

ALLOWED_MIME_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
}
MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB


class DocumentResponse(BaseModel):
    id: str
    original_filename: str
    document_type: Optional[str]
    processing_status: str
    processing_error: Optional[str]
    report_date: Optional[str]
    lab_name: Optional[str]
    doctor_name: Optional[str]
    page_count: Optional[int]
    file_size_bytes: Optional[int]
    extracted_values_count: int
    verified_values_count: int
    created_at: str
    updated_at: str


@router.post("/upload", response_model=dict, status_code=202)
async def upload_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a medical document and enqueue it for async processing."""
    # Validate file type
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type: {file.content_type}. Supported: PDF, JPEG, PNG, WebP.",
        )

    file_bytes = await file.read()

    # Validate file size
    if len(file_bytes) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({len(file_bytes) // (1024*1024)}MB). Maximum size is 50MB.",
        )

    # Create document record
    doc_id = uuid.uuid4()
    object_key = f"users/{current_user.id}/documents/{doc_id}/{file.filename}"

    # Upload to MinIO
    try:
        upload_file(object_key, file_bytes, file.content_type)
    except Exception as e:
        logger.error(f"MinIO upload failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to store the document. Please try again.")

    doc = Document(
        id=doc_id,
        user_id=current_user.id,
        original_filename=file.filename,
        storage_path=object_key,
        file_size_bytes=len(file_bytes),
        mime_type=file.content_type,
        processing_status=ProcessingStatus.PENDING,
    )
    db.add(doc)

    # Create processing job record
    job = ProcessingJob(document_id=doc_id)
    db.add(job)

    # Timeline event
    db.add(TimelineEvent(
        user_id=current_user.id,
        event_type=TimelineEventType.DOCUMENT_UPLOADED,
        title=f"Report uploaded: {file.filename}",
        description="Document uploaded and queued for processing.",
        document_id=doc_id,
    ))

    await db.commit()

    # Enqueue Celery task
    try:
        from app.pipeline.tasks import process_document_task
        task = process_document_task.delay(
            str(doc_id),
            object_key,
            file.content_type,
            file.filename,
        )
        async with db.begin_nested():
            job.celery_task_id = task.id
            job.current_stage = ProcessingStatus.UPLOADING
            job.started_at = datetime.now(timezone.utc)
        await db.commit()
    except Exception as e:
        logger.error(f"Failed to enqueue Celery task: {e}")
        # Don't fail the upload — the job can be retried

    return {
        "document_id": str(doc_id),
        "status": "accepted",
        "message": "Document uploaded successfully. Processing has started.",
    }


@router.get("", response_model=dict)
async def list_documents(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    document_type: Optional[str] = None,
    processing_status: Optional[str] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List user's documents with filtering and pagination."""
    try:
        page_val = int(page)
    except Exception:
        page_val = 1
    try:
        page_size_val = int(page_size)
    except Exception:
        page_size_val = 20

    query = select(Document).where(Document.user_id == current_user.id)

    if document_type:
        query = query.where(Document.document_type == document_type)
    if processing_status:
        query = query.where(Document.processing_status == processing_status)
    if search:
        query = query.where(Document.original_filename.ilike(f"%{search}%"))

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar()

    query = query.order_by(desc(Document.created_at)).offset((page_val - 1) * page_size_val).limit(page_size_val)
    result = await db.execute(query)
    documents = result.scalars().all()

    return {
        "items": [_doc_response(d) for d in documents],
        "total": total,
        "page": page_val,
        "page_size": page_size_val,
        "pages": (total + page_size_val - 1) // page_size_val if page_size_val > 0 else 1,
    }


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    doc = await _get_user_doc(document_id, current_user.id, db)
    return DocumentResponse(**_doc_response(doc))


@router.get("/{document_id}/url")
async def get_document_url(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a time-limited presigned URL for direct document access."""
    doc = await _get_user_doc(document_id, current_user.id, db)
    try:
        url = get_presigned_url(doc.storage_path, expiry_seconds=3600)
        return {"url": url, "expires_in_seconds": 3600}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Could not generate document URL")


@router.delete("/{document_id}", status_code=204)
async def delete_document(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    doc = await _get_user_doc(document_id, current_user.id, db)
    try:
        delete_file(doc.storage_path)
    except Exception as e:
        logger.warning(f"Could not delete file from storage: {e}")
    await db.delete(doc)
    await db.commit()


@router.post("/{document_id}/reprocess", response_model=dict)
async def reprocess_document(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Re-enqueue a document for AI OCR processing."""
    doc = await _get_user_doc(document_id, current_user.id, db)

    doc.processing_status = ProcessingStatus.PENDING
    doc.processing_error = None

    job_result = await db.execute(
        select(ProcessingJob).where(ProcessingJob.document_id == document_id)
    )
    job = job_result.scalar_one_or_none()
    if not job:
        job = ProcessingJob(document_id=document_id)
        db.add(job)
    else:
        job.current_stage = ProcessingStatus.PENDING
        job.stages_completed = []
        job.started_at = None
        job.completed_at = None
        job.error_message = None

    await db.commit()

    try:
        from app.pipeline.tasks import process_document_task
        task = process_document_task.delay(
            str(document_id),
            doc.storage_path,
            doc.mime_type,
            doc.original_filename,
        )
        job.celery_task_id = task.id
        job.current_stage = ProcessingStatus.UPLOADING
        job.started_at = datetime.now(timezone.utc)
        await db.commit()
    except Exception as e:
        logger.error(f"Failed to enqueue Celery task for reprocess: {e}")
        raise HTTPException(status_code=500, detail="Failed to enqueue document processing")

    return {
        "document_id": str(document_id),
        "status": "accepted",
        "message": "Document re-queued for processing.",
    }


async def _get_user_doc(document_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession) -> Document:
    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.user_id == user_id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


def _doc_response(doc: Document) -> dict:
    return {
        "id": str(doc.id),
        "original_filename": doc.original_filename,
        "document_type": doc.document_type.value if doc.document_type else None,
        "processing_status": doc.processing_status.value,
        "processing_error": doc.processing_error,
        "report_date": doc.report_date.date().isoformat() if doc.report_date else None,
        "lab_name": doc.lab_name,
        "doctor_name": doc.doctor_name,
        "page_count": doc.page_count,
        "file_size_bytes": doc.file_size_bytes,
        "extracted_values_count": doc.extracted_values_count,
        "verified_values_count": doc.verified_values_count,
        "created_at": doc.created_at.isoformat(),
        "updated_at": doc.updated_at.isoformat(),
    }
