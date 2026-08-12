import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import (
    String, Text, Float, Boolean, Integer, DateTime, ForeignKey,
    Enum as SAEnum, JSON, Index, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, ARRAY
import enum

from app.database import Base


class ProcessingStatus(str, enum.Enum):
    PENDING = "pending"
    UPLOADING = "uploading"
    READING = "reading"
    OCR = "ocr"
    CLASSIFYING = "classifying"
    EXTRACTING = "extracting"
    NORMALIZING = "normalizing"
    VALIDATING = "validating"
    READY = "ready"
    FAILED = "failed"


class DocumentType(str, enum.Enum):
    BLOOD = "blood"
    LIPID = "lipid"
    THYROID = "thyroid"
    DIABETES = "diabetes"
    KIDNEY = "kidney"
    LIVER = "liver"
    VITAMIN = "vitamin"
    URINE = "urine"
    HORMONAL = "hormonal"
    HEART = "heart"
    PRESCRIPTION = "prescription"
    IMAGING = "imaging"
    OTHER = "other"


class VerificationStatus(str, enum.Enum):
    UNVERIFIED = "unverified"
    VERIFIED = "verified"
    EDITED = "edited"


class TimelineEventType(str, enum.Enum):
    DOCUMENT_UPLOADED = "document_uploaded"
    DOCUMENT_PROCESSED = "document_processed"
    DOCUMENT_FAILED = "document_failed"
    METRIC_EXTRACTED = "metric_extracted"
    METRIC_VERIFIED = "metric_verified"
    METRIC_EDITED = "metric_edited"
    MEDICATION_ADDED = "medication_added"
    MEDICATION_STOPPED = "medication_stopped"
    PROFILE_UPDATED = "profile_updated"
    ACCOUNT_CREATED = "account_created"


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    date_of_birth: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    sex: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    # User-entered conditions — explicitly labeled as not diagnosed
    user_entered_conditions: Mapped[Optional[list]] = mapped_column(JSON, nullable=True, default=list)
    notification_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    documents: Mapped[list["Document"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    metrics: Mapped[list["Metric"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    timeline_events: Mapped[list["TimelineEvent"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    conversations: Mapped[list["AIConversation"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    medications: Mapped[list["Medication"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    reminders: Mapped[list["Reminder"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    feedbacks: Mapped[list["Feedback"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Feedback(Base):
    __tablename__ = "feedbacks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    feedback_type: Mapped[str] = mapped_column(String(50), nullable=False, default="general")  # "general", "bug", "feature_request", "data_issue", "question"
    rating: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # 1 to 5
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="open")  # "open", "in_review", "resolved"
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="feedbacks")


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    original_filename: Mapped[str] = mapped_column(String(500), nullable=False)
    storage_path: Mapped[str] = mapped_column(String(1000), nullable=False)  # MinIO object key
    file_size_bytes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    document_type: Mapped[Optional[DocumentType]] = mapped_column(SAEnum(DocumentType), nullable=True)
    processing_status: Mapped[ProcessingStatus] = mapped_column(
        SAEnum(ProcessingStatus), default=ProcessingStatus.PENDING, nullable=False
    )
    processing_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    report_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    lab_name: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    doctor_name: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    page_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    extracted_values_count: Mapped[int] = mapped_column(Integer, default=0)
    verified_values_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="documents")
    metrics: Mapped[list["Metric"]] = relationship(back_populates="document", cascade="all, delete-orphan")
    processing_job: Mapped[Optional["ProcessingJob"]] = relationship(back_populates="document", uselist=False)

    __table_args__ = (
        Index("ix_documents_user_id_created_at", "user_id", "created_at"),
    )


class ProcessingJob(Base):
    __tablename__ = "processing_jobs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    celery_task_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    current_stage: Mapped[ProcessingStatus] = mapped_column(
        SAEnum(ProcessingStatus), default=ProcessingStatus.PENDING
    )
    stages_completed: Mapped[list] = mapped_column(JSON, default=list)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    document: Mapped["Document"] = relationship(back_populates="processing_job")


class Metric(Base):
    """
    A single extracted health value, always linked to its source document.
    Provenance is mandatory: every metric knows exactly where it came from.
    """
    __tablename__ = "metrics"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False
    )
    metric_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    metric_category: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g. "blood", "lipid"
    value: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String(50), nullable=False)
    # Original extracted value before normalization
    raw_value: Mapped[str] = mapped_column(String(255), nullable=False)
    raw_unit: Mapped[str] = mapped_column(String(100), nullable=False)
    measured_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    # Reference range from the report
    reference_range_low: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    reference_range_high: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    reference_range_unit: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    # Confidence and verification
    confidence_score: Mapped[float] = mapped_column(Float, default=1.0)  # 0.0–1.0
    verification_status: Mapped[VerificationStatus] = mapped_column(
        SAEnum(VerificationStatus), default=VerificationStatus.UNVERIFIED
    )
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    # Source provenance
    source_page: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    source_location: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)  # e.g. "Table row 3"
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="metrics")
    document: Mapped["Document"] = relationship(back_populates="metrics")

    __table_args__ = (
        Index("ix_metrics_user_metric_date", "user_id", "metric_name", "measured_at"),
        Index("ix_metrics_user_category", "user_id", "metric_category"),
    )


class TimelineEvent(Base):
    __tablename__ = "timeline_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type: Mapped[TimelineEventType] = mapped_column(SAEnum(TimelineEventType), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Optional references to related entities
    document_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    metric_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    event_metadata: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="timeline_events")

    __table_args__ = (
        Index("ix_timeline_user_occurred_at", "user_id", "occurred_at"),
    )


class AIConversation(Base):
    __tablename__ = "ai_conversations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="conversations")
    messages: Mapped[list["AIMessage"]] = relationship(
        back_populates="conversation", cascade="all, delete-orphan", order_by="AIMessage.created_at"
    )


class AIMessage(Base):
    __tablename__ = "ai_messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ai_conversations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False)  # "user" | "assistant"
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # Structured citations: list of {type: "metric"|"document", id: uuid, label: str}
    citations: Mapped[Optional[list]] = mapped_column(JSON, nullable=True, default=list)
    # Optional chart spec for structured responses
    chart_spec: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    conversation: Mapped["AIConversation"] = relationship(back_populates="messages")


class Medication(Base):
    __tablename__ = "medications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(100), nullable=False, default="other")  # e.g. "diabetes", "lipid", "vital", "thyroid", "vitamin"
    dosage: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g. "500 mg", "10 mg"
    frequency: Mapped[str] = mapped_column(String(100), nullable=False, default="Once Daily")  # e.g. "Twice Daily (After Meals)"
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="active")  # "active" | "discontinued"
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    prescribing_doctor: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    generic_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # Active chemical composition
    manufacturer: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # Mfr / Pharma company
    packaging_info: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # Pack size e.g. "Strip of 10 tablets"
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="medications")

    __table_args__ = (
        Index("ix_medications_user_category", "user_id", "category"),
    )


class Reminder(Base):
    __tablename__ = "reminders"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False, default="diabetes")
    reminder_type: Mapped[str] = mapped_column(String(50), nullable=False, default="recurring")
    frequency_value: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, default=2)
    frequency_unit: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, default="months")
    next_due_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_completed_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    notify_before_days: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="reminders")

    __table_args__ = (
        Index("ix_reminders_user_due", "user_id", "next_due_date"),
    )


