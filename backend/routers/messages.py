from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from auth import get_current_user
from database import get_db
from models import Message, User, UserRole
from schemas import MessageCreate, MessageOut, MessageUpdate
from services.chat import (
    create_mention_notifications,
    emit_new_message,
    emit_notification,
    get_member_channel,
    message_to_out,
)

router = APIRouter(prefix="/api/channels", tags=["messages"])


@router.get("/{channel_id}/messages", response_model=list[MessageOut])
async def get_messages(
    channel_id: int,
    limit: int = Query(default=50, ge=1, le=100),
    before_id: int | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    channel = await get_member_channel(channel_id, current_user.id, db)
    if channel is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Canal no encontrado")

    query = (
        select(Message)
        .where(Message.channel_id == channel_id)
        .options(selectinload(Message.sender), selectinload(Message.reactions))
        .order_by(Message.id.desc())
        .limit(limit)
    )

    if before_id is not None:
        query = query.where(Message.id < before_id)

    result = await db.execute(query)
    messages = list(reversed(result.scalars().all()))
    return [message_to_out(message, current_user_id=current_user.id) for message in messages]


@router.post("/{channel_id}/messages", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
async def create_message(
    channel_id: int,
    payload: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    content = payload.content.strip()
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El mensaje no puede estar vacío")

    channel = await get_member_channel(channel_id, current_user.id, db)
    if channel is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Canal no encontrado")

    if channel.slug == "avisos" and current_user.role != UserRole.gerencia:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo gerencia puede escribir en #avisos",
        )

    message = Message(channel_id=channel_id, sender_id=current_user.id, content=content)
    db.add(message)
    await db.commit()
    await db.refresh(message)

    result = await db.execute(
        select(Message)
        .where(Message.id == message.id)
        .options(selectinload(Message.sender))
    )
    message = result.scalar_one()

    notifications = await create_mention_notifications(db, message, current_user, content)
    for notification in notifications:
        await emit_notification(notification, current_user)

    await emit_new_message(message)
    return message_to_out(message, current_user_id=current_user.id)
