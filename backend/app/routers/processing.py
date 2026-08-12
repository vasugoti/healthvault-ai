"""
Processing router: job status polling + SSE real-time stage updates.
"""
import asyncio
import json
import uuid
import logging
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import Document, ProcessingJob
from app.dependencies import get_current_user
from app.models import User
from app.config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/processing", tags=["processing"])
settings = get_settings()


@router.get("/{document_id}/status")
async def get_processing_status(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Poll the current processing status of a document."""
    doc = await _get_user_doc(document_id, current_user.id, db)

    job_result = await db.execute(
        select(ProcessingJob).where(ProcessingJob.document_id == document_id)
    )
    job = job_result.scalar_one_or_none()

    return {
        "document_id": str(document_id),
        "processing_status": doc.processing_status.value,
        "processing_error": doc.processing_error,
        "current_stage": job.current_stage.value if job else None,
        "stages_completed": job.stages_completed if job else [],
        "started_at": job.started_at.isoformat() if job and job.started_at else None,
        "completed_at": job.completed_at.isoformat() if job and job.completed_at else None,
    }


@router.get("/{document_id}/stream")
async def stream_processing_status(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    SSE endpoint: streams real-time pipeline stage updates from Redis pub/sub.
    The client should open this as an EventSource and close it when stage = 'ready' or 'failed'.
    """
    # Verify ownership
    await _get_user_doc(document_id, current_user.id, db)

    async def event_generator():
        import redis.asyncio as aioredis
        r = await aioredis.from_url(settings.redis_url)
        pubsub = r.pubsub()
        channel = f"job:{document_id}:progress"

        await pubsub.subscribe(channel)
        try:
            # First, yield current status from DB
            doc_result = await db.execute(
                select(Document).where(Document.id == document_id)
            )
            doc = doc_result.scalar_one_or_none()
            if doc:
                payload = json.dumps({
                    "stage": doc.processing_status.value,
                    "message": f"Current status: {doc.processing_status.value}",
                })
                yield f"data: {payload}\n\n"

                if doc.processing_status.value in ("ready", "failed"):
                    return

            # Stream from Redis pub/sub
            timeout_seconds = 300  # 5 minute timeout
            elapsed = 0
            while elapsed < timeout_seconds:
                message = await asyncio.wait_for(pubsub.get_message(ignore_subscribe_messages=True), timeout=1.0)
                if message and message["type"] == "message":
                    data = message["data"]
                    if isinstance(data, bytes):
                        data = data.decode()
                    yield f"data: {data}\n\n"
                    parsed = json.loads(data)
                    if parsed.get("stage") in ("ready", "failed"):
                        break
                else:
                    yield ": keepalive\n\n"
                elapsed += 1
        except asyncio.TimeoutError:
            yield f"data: {json.dumps({'stage': 'failed', 'message': 'Processing timed out'})}\n\n"
        except Exception as e:
            logger.error(f"SSE stream error: {e}")
        finally:
            await pubsub.unsubscribe(channel)
            await r.aclose()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


async def _get_user_doc(document_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession) -> Document:
    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.user_id == user_id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc
