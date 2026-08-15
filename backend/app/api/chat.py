import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.db import get_db
from app.core.rate_limit import RateLimitExceededError, check_rate_limit
from app.models.user import User
from app.schemas.chat import ChatMessageOut, CitedRelativeOut, SendMessageRequest, SendMessageResponse
from app.services.auth_service import get_person_by_user_id
from app.services.chat_service import (
    ChatSessionNotFoundError,
    add_message,
    create_session,
    get_own_session,
    list_messages,
)
from app.services.rag_service import answer_question

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("", response_model=SendMessageResponse)
async def send_message(
    data: SendMessageRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SendMessageResponse:
    person = await get_person_by_user_id(db, current_user.id)
    if person is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No person record for this user")

    try:
        check_rate_limit(
            person.id,
            settings.chat_rate_limit_max_requests,
            settings.chat_rate_limit_window_seconds,
        )
    except RateLimitExceededError as exc:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            f"Too many messages — try again in {exc.retry_after_seconds}s",
            headers={"Retry-After": str(exc.retry_after_seconds)},
        ) from exc

    if data.session_id is not None:
        try:
            session = await get_own_session(db, person.id, data.session_id)
        except ChatSessionNotFoundError as exc:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Chat session not found") from exc
    else:
        session = await create_session(db, person.id, person.family_id)

    await add_message(db, session.id, "user", data.message)
    result = await answer_question(db, person, data.message)
    await add_message(db, session.id, "assistant", result.answer)

    return SendMessageResponse(
        session_id=session.id,
        answer=result.answer,
        cited_relatives=[CitedRelativeOut(**r) for r in result.cited_relatives],
    )


@router.get("/sessions/{session_id}/messages", response_model=list[ChatMessageOut])
async def get_session_messages(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ChatMessageOut]:
    person = await get_person_by_user_id(db, current_user.id)
    if person is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No person record for this user")

    try:
        session = await get_own_session(db, person.id, session_id)
    except ChatSessionNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Chat session not found") from exc

    messages = await list_messages(db, session.id)
    return [ChatMessageOut.model_validate(m) for m in messages]
