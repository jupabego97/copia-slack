from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from auth import get_current_user
from database import get_db
from models import Message, MessageReaction, User
from schemas import MessageOut, ReactionCreate
from services.chat import get_member_channel, message_to_out

router = APIRouter(prefix="/api/messages", tags=["reactions"])

ALLOWED_EMOJIS = {"👍", "❤️", "✅", "👀", "🎉", "🙏"}


@router.post("/{message_id}/reactions", response_model=MessageOut)
async def toggle_reaction(
    message_id: int,
    payload: ReactionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    emoji = payload.emoji.strip()
    if emoji not in ALLOWED_EMOJIS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Reacción no permitida")

    result = await db.execute(
        select(Message)
        .where(Message.id == message_id)
        .options(selectinload(Message.sender), selectinload(Message.reactions))
    )
    message = result.scalar_one_or_none()
    if message is None or await get_member_channel(message.channel_id, current_user.id, db) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mensaje no encontrado")

    existing = await db.execute(
        select(MessageReaction).where(
            MessageReaction.message_id == message_id,
            MessageReaction.user_id == current_user.id,
            MessageReaction.emoji == emoji,
        )
    )
    reaction = existing.scalar_one_or_none()
    if reaction is None:
        new_reaction = MessageReaction(message_id=message_id, user_id=current_user.id, emoji=emoji)
        db.add(new_reaction)
        message.reactions.append(new_reaction)
    else:
        message.reactions.remove(reaction)
        await db.delete(reaction)
    await db.commit()
    return message_to_out(message, current_user_id=current_user.id)
