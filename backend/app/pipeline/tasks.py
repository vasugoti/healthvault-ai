"""
Celery task for the full async document processing pipeline.

Stages (reported via Redis pub/sub for SSE streaming):
  UPLOADING → READING → OCR → CLASSIFYING → EXTRACTING → NORMALIZING → VALIDATING → READY
"""
import uuid
import logging
from datetime import datetime, timezone
from celery import Celery

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

celery_app = Celery(
    "healthvault",
    broker=settings.redis_url,
    backend=settings.redis_url,
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
)

celery_app.conf.beat_schedule = {
    "daily-reminder-check": {
        "task": "check_and_send_due_reminders",
        # Run daily at 08:00 AM UTC
        "schedule": 86400.0,  # 24 hours in seconds (or crontab(hour=8, minute=0))
    },
}


def publish_stage(redis_client, job_id: str, stage: str, message: str = ""):
    """Publish a pipeline stage update to Redis pub/sub for SSE consumers."""
    import json
    channel = f"job:{job_id}:progress"
    payload = json.dumps({"stage": stage, "message": message, "ts": datetime.now(timezone.utc).isoformat()})
    redis_client.publish(channel, payload)


@celery_app.task(bind=True, name="process_document")
def process_document_task(self, document_id: str, object_key: str, mime_type: str, original_filename: str):
    """
    Full document processing pipeline as a Celery task.
    Uses synchronous DB access (via a separate sync session) for Celery compatibility.
    """
    import redis
    import json
    from sqlalchemy import create_engine, select
    from sqlalchemy.orm import sessionmaker

    # Use synchronous engine for Celery (asyncpg not compatible with Celery workers)
    sync_db_url = settings.database_url.replace("+asyncpg", "+psycopg2")
    engine = create_engine(sync_db_url)
    SessionLocal = sessionmaker(bind=engine)

    redis_client = redis.from_url(settings.redis_url)
    job_id = document_id  # Use doc ID as job channel

    def update_stage(stage: str, message: str = ""):
        publish_stage(redis_client, job_id, stage, message)
        with SessionLocal() as session:
            from app.models import ProcessingJob, ProcessingStatus
            job = session.execute(
                select(ProcessingJob).where(ProcessingJob.document_id == uuid.UUID(document_id))
            ).scalar_one_or_none()
            if job:
                job.current_stage = ProcessingStatus(stage)
                session.commit()

    try:
        from app.models import (
            Document, Metric, ProcessingJob, ProcessingStatus, TimelineEvent,
            TimelineEventType, VerificationStatus, DocumentType
        )
        from app.storage import download_file
        from app.pipeline.ocr import extract_from_document, normalize_metric, parse_reference_range
        import asyncio

        # Stage: READING
        update_stage("reading", "Reading document from storage")
        file_bytes = download_file(object_key)

        # Stage: OCR + EXTRACTING
        update_stage("ocr", "Running AI document analysis")
        extraction_result = asyncio.run(
            extract_from_document(file_bytes, mime_type, original_filename)
        )

        # Stage: CLASSIFYING
        update_stage("classifying", "Identifying report type")
        doc_type_str = extraction_result.get("document_type", "other")
        try:
            doc_type = DocumentType(doc_type_str)
        except ValueError:
            doc_type = DocumentType.OTHER

        # Stage: EXTRACTING
        update_stage("extracting", "Extracting health metrics")
        raw_metrics = extraction_result.get("metrics", [])

        # Stage: NORMALIZING
        update_stage("normalizing", "Normalizing units and values")
        normalized_metrics = []
        for m in raw_metrics:
            try:
                value, unit = normalize_metric(m["raw_value"], m["raw_unit"], m["metric_name"])
                ref_low, ref_high, ref_unit = parse_reference_range(m.get("reference_range"))
                normalized_metrics.append({
                    **m,
                    "value": value,
                    "unit": unit,
                    "reference_range_low": ref_low,
                    "reference_range_high": ref_high,
                    "reference_range_unit": ref_unit,
                })
            except Exception as e:
                logger.warning(f"Could not normalize metric {m.get('metric_name')}: {e}")
                # Still include with low confidence
                try:
                    value = float(m["raw_value"].replace(",", "."))
                except Exception:
                    continue
                normalized_metrics.append({
                    **m,
                    "value": value,
                    "unit": m["raw_unit"],
                    "reference_range_low": None,
                    "reference_range_high": None,
                    "reference_range_unit": None,
                    "confidence_score": min(m.get("confidence_score", 0.5), 0.4),
                })

        # Stage: VALIDATING
        update_stage("validating", "Flagging values for verification")

        doc_uuid = uuid.UUID(document_id)
        report_date_str = extraction_result.get("report_date")
        report_date = None
        if report_date_str:
            try:
                from datetime import date
                report_date = datetime.strptime(report_date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            except Exception:
                pass

        with SessionLocal() as session:
            doc = session.execute(select(Document).where(Document.id == doc_uuid)).scalar_one()
            doc.document_type = doc_type
            doc.processing_status = ProcessingStatus.READY
            doc.lab_name = extraction_result.get("lab_name")
            doc.doctor_name = extraction_result.get("doctor_name")
            doc.page_count = extraction_result.get("page_count")
            doc.report_date = report_date
            doc.extracted_values_count = len(normalized_metrics)

            metric_objects = []
            for m in normalized_metrics:
                measured_at = report_date  # Use report date as measurement date
                metric = Metric(
                    user_id=doc.user_id,
                    document_id=doc_uuid,
                    metric_name=m["metric_name"],
                    metric_category=m.get("metric_category", doc_type_str),
                    value=m["value"],
                    unit=m["unit"],
                    raw_value=m["raw_value"],
                    raw_unit=m["raw_unit"],
                    measured_at=measured_at,
                    reference_range_low=m.get("reference_range_low"),
                    reference_range_high=m.get("reference_range_high"),
                    reference_range_unit=m.get("reference_range_unit"),
                    confidence_score=m.get("confidence_score", 1.0),
                    verification_status=VerificationStatus.UNVERIFIED,
                    source_page=m.get("source_page"),
                    source_location=m.get("source_location"),
                )
                metric_objects.append(metric)
                session.add(metric)

            # Add timeline event
            session.add(TimelineEvent(
                user_id=doc.user_id,
                event_type=TimelineEventType.DOCUMENT_PROCESSED,
                title=f"Report processed: {doc.original_filename}",
                description=f"Extracted {len(normalized_metrics)} health metrics from {doc_type_str} report.",
                document_id=doc_uuid,
                event_metadata={"metric_count": len(normalized_metrics), "document_type": doc_type_str},
            ))

            session.commit()

        update_stage("ready", f"Processing complete. Found {len(normalized_metrics)} metrics.")

    except Exception as e:
        logger.error(f"Document processing failed for {document_id}: {e}", exc_info=True)
        publish_stage(redis_client, job_id, "failed", str(e))

        try:
            from sqlalchemy import create_engine, select
            from sqlalchemy.orm import sessionmaker as sm
            sync_db_url2 = settings.database_url.replace("+asyncpg", "+psycopg2")
            eng = create_engine(sync_db_url2)
            SL = sm(bind=eng)
            from app.models import Document, ProcessingJob, ProcessingStatus, TimelineEvent, TimelineEventType
            with SL() as session:
                doc = session.execute(select(Document).where(Document.id == uuid.UUID(document_id))).scalar_one_or_none()
                if doc:
                    doc.processing_status = ProcessingStatus.FAILED
                    doc.processing_error = str(e)
                    session.add(TimelineEvent(
                        user_id=doc.user_id,
                        event_type=TimelineEventType.DOCUMENT_FAILED,
                        title=f"Processing failed: {doc.original_filename}",
                        description=f"Error: {str(e)[:200]}",
                        document_id=uuid.UUID(document_id),
                    ))
                    session.commit()
        except Exception as inner_e:
            logger.error(f"Failed to update document status after pipeline error: {inner_e}")

        raise


@celery_app.task(name="check_and_send_due_reminders")
def check_and_send_due_reminders_task():
    """Celery task for daily health reminder email check."""
    from app.pipeline.reminder_checker import check_and_send_due_reminders
    return check_and_send_due_reminders()

