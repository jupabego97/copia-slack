from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from auth import get_current_user
from database import get_db
from models import Message, User, UserRole
from schemas import MessageOut, MessageUpdate
from services.chat import get_member_channel, message_to_out

router = APIRouter(prefix="/api/messages", tags=["message-actions"])


@router.patch("/{message_id}", response_model=MessageOut)
async def update_message(
    message_id: int,
    payload: MessageUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Message).where(Message.id == message_id).options(selectinload(Message.sender), selectinload(Message.reactions))
    )
    message = result.scalar_one_or_none()
    if message is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mensaje no encontrado")

    channel = await get_member_channel(message.channel_id, current_user.id, db)
    if channel is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes acceso a este mensaje")

    if message.sender_id != current_user.id and current_user.role != UserRole.gerencia:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No puedes editar este mensaje")

    content = payload.content.strip()
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El mensaje no puede estar vacío")

    from datetime import datetime, timezone

    message.content = content
    message.edited_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(message)

    from connection_manager import manager

    message_out = message_to_out(message, current_user_id=current_user.id)
    await manager.broadcast_to_channel(
        message.channel_id,
        {
            "type": "message_updated",
            "channel_id": message.channel_id,
            "message": message_out.model_dump(mode="json"),
        },
    )

    return message_out


@router.delete("/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_message(
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Message).where(Message.id == message_id))
    message = result.scalar_one_or_none()
    if message is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mensaje no encontrado")

    channel = await get_member_channel(message.channel_id, current_user.id, db)
    if channel is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes acceso a este mensaje")

    if message.sender_id != current_user.id and current_user.role != UserRole.gerencia:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No puedes eliminar este mensaje")

    channel_id = message.channel_id
    await db.delete(message)
    await db.commit()

    from connection_manager import manager

    await manager.broadcast_to_channel(
        channel_id,
        {"type": "message_deleted", "channel_id": channel_id, "message_id": message_id},
    )
