from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from auth import get_current_user
from database import get_db
from models import Channel, ChannelMember, User
from schemas import ChannelOut, UserOut

router = APIRouter(prefix="/api/channels", tags=["channels"])


def _channel_to_out(channel: Channel) -> ChannelOut:
    return ChannelOut(
        id=channel.id,
        name=channel.name,
        slug=channel.slug,
        description=channel.description,
        is_direct_message=channel.is_direct_message,
        created_at=channel.created_at,
        members=[UserOut.model_validate(member.user) for member in channel.members],
    )


@router.get("", response_model=list[ChannelOut])
async def list_channels(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Channel)
        .join(ChannelMember, ChannelMember.channel_id == Channel.id)
        .where(ChannelMember.user_id == current_user.id)
        .options(
            selectinload(Channel.members).selectinload(ChannelMember.user),
        )
        .order_by(Channel.is_direct_message.asc(), Channel.name.asc())
    )
    channels = result.scalars().unique().all()
    return [_channel_to_out(channel) for channel in channels]
