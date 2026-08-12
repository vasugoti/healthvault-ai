"""
AI Assistant router: chat with the grounded health AI.
"""
import uuid
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from pydantic import BaseModel

from app.database import get_db
from app.models import AIConversation, AIMessage, User
from app.dependencies import get_current_user
from app.ai.assistant import chat

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/assistant", tags=["assistant"])

SUGGESTED_QUESTIONS = [
    "What reports have I uploaded?",
    "Show me my HbA1c trend over time",
    "What metrics need my verification?",
    "What was my cholesterol in my last report?",
    "Which values have changed the most?",
    "What health data do you have about me?",
]


class MessageRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None


class MessageResponse(BaseModel):
    conversation_id: str
    message_id: str
    text: str
    citations: list[dict]
    chart: Optional[dict]
    no_data_response: bool


@router.get("/conversations", response_model=dict)
async def list_conversations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AIConversation)
        .where(AIConversation.user_id == current_user.id)
        .order_by(desc(AIConversation.updated_at))
        .limit(50)
    )
    conversations = result.scalars().all()
    return {
        "items": [
            {
                "id": str(c.id),
                "title": c.title or "New conversation",
                "created_at": c.created_at.isoformat(),
                "updated_at": c.updated_at.isoformat(),
            }
            for c in conversations
        ],
        "suggested_questions": SUGGESTED_QUESTIONS,
    }


@router.get("/conversations/{conversation_id}/messages", response_model=dict)
async def get_conversation_messages(
    conversation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conv = await _get_user_conversation(conversation_id, current_user.id, db)
    result = await db.execute(
        select(AIMessage)
        .where(AIMessage.conversation_id == conversation_id)
        .order_by(AIMessage.created_at)
    )
    messages = result.scalars().all()
    return {
        "conversation_id": str(conv.id),
        "title": conv.title or "New conversation",
        "messages": [
            {
                "id": str(m.id),
                "role": m.role,
                "content": m.content,
                "citations": m.citations or [],
                "chart": m.chart_spec,
                "created_at": m.created_at.isoformat(),
            }
            for m in messages
        ],
    }


@router.post("/chat", response_model=MessageResponse)
async def chat_endpoint(
    data: MessageRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Send a message to the AI assistant and get a grounded response."""
    if not data.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    # Get or create conversation
    if data.conversation_id:
        try:
            conv_id = uuid.UUID(data.conversation_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid conversation_id")
        conv = await _get_user_conversation(conv_id, current_user.id, db)
    else:
        conv = AIConversation(
            user_id=current_user.id,
            title=data.message[:80],
        )
        db.add(conv)
        await db.flush()

    # Load conversation history for context
    history_result = await db.execute(
        select(AIMessage)
        .where(AIMessage.conversation_id == conv.id)
        .order_by(AIMessage.created_at)
        .limit(20)
    )
    history = [
        {"role": m.role, "content": m.content}
        for m in history_result.scalars().all()
    ]

    # Save user message
    user_msg = AIMessage(
        conversation_id=conv.id,
        role="user",
        content=data.message,
    )
    db.add(user_msg)
    await db.flush()

    # Get AI response
    try:
        response = await chat(
            user_id=current_user.id,
            user_message=data.message,
            conversation_history=history + [{"role": "user", "content": data.message}],
            db=db,
        )
    except Exception as e:
        logger.error(f"AI assistant error: {e}", exc_info=True)
        raise HTTPException(
            status_code=503,
            detail="The AI assistant is temporarily unavailable. Please try again.",
        )

    # Save assistant message
    assistant_msg = AIMessage(
        conversation_id=conv.id,
        role="assistant",
        content=response["text"],
        citations=response.get("citations", []),
        chart_spec=response.get("chart"),
    )
    db.add(assistant_msg)
    await db.commit()

    return MessageResponse(
        conversation_id=str(conv.id),
        message_id=str(assistant_msg.id),
        text=response["text"],
        citations=response.get("citations", []),
        chart=response.get("chart"),
        no_data_response=response.get("no_data_response", False),
    )


@router.delete("/conversations/{conversation_id}", status_code=204)
async def delete_conversation(
    conversation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conv = await _get_user_conversation(conversation_id, current_user.id, db)
    await db.delete(conv)
    await db.commit()


async def _get_user_conversation(conv_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession) -> AIConversation:
    result = await db.execute(
        select(AIConversation).where(AIConversation.id == conv_id, AIConversation.user_id == user_id)
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv
