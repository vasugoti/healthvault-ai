"""
AI Assistant powered by Gemini — grounded strictly in the user's own health data.

Core safety constraints (hardcoded, not user-configurable):
  1. No diagnostic language — describe the data, never interpret it medically
  2. Every claim must be grounded in a specific metric or document from the user's record
  3. Return structured JSON with citations — no free-text-only responses
  4. Explicitly decline when user data is insufficient to answer
"""
import json
import logging
import uuid
from typing import Optional
import google.generativeai as genai

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

genai.configure(api_key=settings.gemini_api_key)

ASSISTANT_SYSTEM_PROMPT = """
You are HealthVault AI's health data assistant. You help users understand their OWN health records.

## ABSOLUTE RULES — NEVER VIOLATE THESE:
1. You NEVER diagnose, suggest diagnoses, or use diagnostic language.
   - ❌ "Your HbA1c suggests pre-diabetes"
   - ✅ "Your recorded HbA1c values across your uploaded reports show X"
2. Every factual claim about health data MUST cite a specific metric_id or document_id from the provided context.
3. If the user's data does not contain enough information to answer, say so explicitly. NEVER guess or generalize.
4. You NEVER extrapolate trends into the future or make predictions.
5. You NEVER recommend medications, supplements, dosages, or treatments.
6. You NEVER compare the user's values to "typical" or "average" values for their demographic — only to their own historical data and the reference ranges shown on their uploaded reports.
7. You ALWAYS remind users that this is a summary of their uploaded documents, not a clinical assessment.

## RESPONSE FORMAT:
Always return a valid JSON object (no markdown fences) with this exact schema:
{
  "text": "Your response text here",
  "citations": [
    {
      "type": "metric",
      "id": "uuid-of-metric",
      "label": "HbA1c (6.2%, 2024-03-15)"
    }
  ],
  "chart": null,
  "no_data_response": false
}

If you lack data to answer: set "no_data_response": true and explain in "text" what data is missing.
If the user asks for a chart, set "chart" to: {"type": "line", "metric_name": "HbA1c"} or similar.

## WHAT YOU CAN DO:
- Summarize trends in the user's recorded values ("Your HbA1c has been recorded X times")
- List which reports have been uploaded
- Compare values across different reports or dates
- Explain what a test name means (in plain language, no diagnosis)
- Tell the user which values are unverified and need their review
- Answer questions about what data is available

## WHAT YOU CANNOT DO:
- Diagnose or suggest diagnoses
- Recommend treatments, medications, or supplements
- Make predictions or extrapolate future values
- Provide advice that should come from a doctor
"""


async def get_grounding_context(user_id: uuid.UUID, db) -> str:
    """
    Fetch the user's health data to use as context for the AI assistant.
    Returns a structured string describing the user's available data.
    """
    from sqlalchemy import select, desc
    from app.models import Metric, Document, VerificationStatus, ProcessingStatus

    # Get recent verified metrics (last 50)
    metrics_result = await db.execute(
        select(Metric)
        .where(Metric.user_id == user_id)
        .order_by(desc(Metric.measured_at))
        .limit(50)
    )
    metrics = metrics_result.scalars().all()

    # Get documents
    docs_result = await db.execute(
        select(Document)
        .where(Document.user_id == user_id, Document.processing_status == ProcessingStatus.READY)
        .order_by(desc(Document.created_at))
        .limit(20)
    )
    documents = docs_result.scalars().all()

    # Build context string
    context_parts = ["## User's Health Data Context\n"]

    if documents:
        context_parts.append("### Uploaded Reports:")
        for doc in documents:
            context_parts.append(
                f"- [{doc.id}] {doc.original_filename} "
                f"(Type: {doc.document_type}, "
                f"Date: {doc.report_date.date() if doc.report_date else 'unknown'}, "
                f"{doc.extracted_values_count} metrics extracted, "
                f"{doc.verified_values_count} verified)"
            )
    else:
        context_parts.append("### Uploaded Reports: None")

    context_parts.append("\n### Health Metrics (most recent first):")
    if metrics:
        # Group by metric name
        by_name: dict[str, list] = {}
        for m in metrics:
            by_name.setdefault(m.metric_name, []).append(m)

        for name, entries in by_name.items():
            entries_str = ", ".join(
                f"[{e.id}] {e.value} {e.unit} "
                f"({e.measured_at.date() if e.measured_at else 'date unknown'}, "
                f"status: {e.verification_status.value})"
                for e in entries[:5]
            )
            context_parts.append(f"- {name}: {entries_str}")
    else:
        context_parts.append("No health metrics recorded yet.")

    unverified_count = sum(1 for m in metrics if m.verification_status.value == "unverified")
    if unverified_count:
        context_parts.append(f"\n⚠️  {unverified_count} metric(s) are unverified and have not been confirmed by the user.")

    return "\n".join(context_parts)


async def chat(
    user_id: uuid.UUID,
    user_message: str,
    conversation_history: list[dict],
    db,
) -> dict:
    """
    Send a message to the AI assistant and get a structured response.

    Args:
        user_id: The user's ID for fetching grounding context.
        user_message: The user's latest message.
        conversation_history: List of {"role": "user"|"model", "parts": [str]} dicts.
        db: Async database session.

    Returns:
        dict with keys: text, citations, chart, no_data_response
    """
    grounding_context = await get_grounding_context(user_id, db)

    model = genai.GenerativeModel(
        model_name=settings.gemini_model,
        system_instruction=ASSISTANT_SYSTEM_PROMPT,
    )

    # Build the full message history for Gemini
    history = []
    for msg in conversation_history[:-1]:  # Exclude the latest user message
        history.append({
            "role": msg["role"],
            "parts": [msg["content"]]
        })

    chat_session = model.start_chat(history=history)

    # Prepend grounding context to the user's message
    full_message = f"{grounding_context}\n\n---\n\nUser question: {user_message}"

    try:
        response = chat_session.send_message(
            full_message,
            generation_config=genai.types.GenerationConfig(
                temperature=0.1,
                response_mime_type="application/json",
            ),
        )
        raw_text = response.text.strip()
        if raw_text.startswith("```"):
            raw_text = raw_text.split("\n", 1)[1].rsplit("```", 1)[0].strip()

        result = json.loads(raw_text)

        # Validate required fields
        result.setdefault("text", "")
        result.setdefault("citations", [])
        result.setdefault("chart", None)
        result.setdefault("no_data_response", False)

        return result

    except json.JSONDecodeError as e:
        logger.error(f"AI assistant returned invalid JSON: {e}")
        return {
            "text": "I encountered an issue processing your request. Please try again.",
            "citations": [],
            "chart": None,
            "no_data_response": False,
        }
    except Exception as e:
        logger.error(f"AI assistant error: {e}", exc_info=True)
        raise
