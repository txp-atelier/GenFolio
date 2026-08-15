import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chat import ChatMessage, ChatSession


class ChatSessionNotFoundError(Exception):
    pass


async def create_session(db: AsyncSession, person_id: uuid.UUID, family_id: uuid.UUID) -> ChatSession:
    session = ChatSession(person_id=person_id, family_id=family_id)
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


async def get_own_session(
    db: AsyncSession, person_id: uuid.UUID, session_id: uuid.UUID
) -> ChatSession:
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id, ChatSession.person_id == person_id
        )
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise ChatSessionNotFoundError()
    return session


async def add_message(db: AsyncSession, session_id: uuid.UUID, role: str, content: str) -> ChatMessage:
    message = ChatMessage(session_id=session_id, role=role, content=content)
    db.add(message)
    await db.commit()
    await db.refresh(message)
    return message


async def list_messages(db: AsyncSession, session_id: uuid.UUID) -> list[ChatMessage]:
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at)
    )
    return list(result.scalars().all())
