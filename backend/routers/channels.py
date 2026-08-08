import re

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from auth import get_current_user
from database import get_db
from models import Channel, ChannelMember, User
from schemas import ChannelCreate, ChannelOut
from services.chat import channel_to_out, mark_channel_read

router = APIRouter(prefix="/api/channels", tags=["channels"])


async def _load_channel(db: AsyncSession, channel_id: int) -> Channel:
    result = await db.execute(
        select(Channel)
        .where(Channel.id == channel_id)
        .options(selectinload(Channel.members).selectinload(ChannelMember.user))
    )
    channel = result.scalar_one_or_none()
    if channel is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Canal no encontrado")
    return channel


@router.get("/explore", response_model=list[ChannelOut])
async def explore_channels(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    member_channels = select(ChannelMember.channel_id).where(ChannelMember.user_id == current_user.id)
    result = await db.execute(
        select(Channel)
        .where(Channel.is_direct_message.is_(False), ~Channel.id.in_(member_channels))
        .options(selectinload(Channel.members).selectinload(ChannelMember.user))
        .order_by(Channel.name.asc())
    )
    return [await channel_to_out(db, channel, current_user.id) for channel in result.scalars().unique().all()]


@router.post("", response_model=ChannelOut, status_code=status.HTTP_201_CREATED)
async def create_channel(
    payload: ChannelCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    name = " ".join(payload.name.strip().split())
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    if not slug:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El nombre del canal no es válido")

    existing = await db.execute(select(Channel).where(Channel.slug == slug))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ya existe un canal con ese nombre")

    channel = Channel(name=name, slug=slug, description=(payload.description or "").strip() or None)
    db.add(channel)
    await db.flush()
    db.add(ChannelMember(channel_id=channel.id, user_id=current_user.id))
    await db.commit()
    return await channel_to_out(db, await _load_channel(db, channel.id), current_user.id)


@router.post("/{channel_id}/join", response_model=ChannelOut)
async def join_channel(
    channel_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    channel = await _load_channel(db, channel_id)
    if channel.is_direct_message:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No puedes unirte a un mensaje directo")

    membership = await db.execute(
        select(ChannelMember).where(
            ChannelMember.channel_id == channel_id,
            ChannelMember.user_id == current_user.id,
        )
    )
    if membership.scalar_one_or_none() is None:
        db.add(ChannelMember(channel_id=channel_id, user_id=current_user.id))
        await db.commit()

    return await channel_to_out(db, await _load_channel(db, channel_id), current_user.id)


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
    return [await channel_to_out(db, channel, current_user.id) for channel in channels]


@router.post("/{channel_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_read(
    channel_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ChannelMember).where(
            ChannelMember.channel_id == channel_id,
            ChannelMember.user_id == current_user.id,
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Canal no encontrado")

    await mark_channel_read(db, current_user.id, channel_id)
