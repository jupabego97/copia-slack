from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from auth import get_current_user
from connection_manager import manager
from database import get_db
from models import Channel, ChannelMember, Message, User, UserRole
from schemas import MessageCreate, MessageOut, UserOut

router = APIRouter(prefix="/api/channels", tags=["messages"])


async def _get_member_channel(
    channel_id: int, user_id: int, db: AsyncSession
) -> Channel | None:
    result = await db.execute(
        select(Channel)
        .join(ChannelMember, ChannelMember.channel_id == Channel.id)
        .where(and_(Channel.id == channel_id, ChannelMember.user_id == user_id))
    )
    return result.scalar_one_or_none()


def _message_to_out(message: Message) -> MessageOut:
    return MessageOut(
        id=message.id,
        channel_id=message.channel_id,
        sender_id=message.sender_id,
        content=message.content,
        created_at=message.created_at,
        edited_at=message.edited_at,
        sender=UserOut.model_validate(message.sender),
    )


@router.get("/{channel_id}/messages", response_model=list[MessageOut])
async def get_messages(
    channel_id: int,
    limit: int = Query(default=50, ge=1, le=100),
    before_id: int | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    channel = await _get_member_channel(channel_id, current_user.id, db)
    if channel is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Canal no encontrado")

    query = (
        select(Message)
        .where(Message.channel_id == channel_id)
        .options(selectinload(Message.sender))
        .order_by(Message.id.desc())
        .limit(limit)
    )

    if before_id is not None:
        query = query.where(Message.id < before_id)

    result = await db.execute(query)
    messages = list(reversed(result.scalars().all()))
    return [_message_to_out(message) for message in messages]


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

    channel = await _get_member_channel(channel_id, current_user.id, db)
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

    message_out = _message_to_out(message)
    await manager.broadcast(
        {
            "type": "new_message",
            "channel_id": int(channel_id),
            "message": message_out.model_dump(mode="json"),
        }
    )

    return message_out
