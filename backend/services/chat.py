import re
from datetime import datetime, timezone

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from connection_manager import manager
from models import Channel, ChannelMember, ChannelReadState, Message, Notification, NotificationType, User
from schemas import ChannelOut, MessageOut, NotificationOut, ReactionOut, UserOut

MENTION_PATTERN = re.compile(r"@([a-zA-Z0-9_]+)")


def message_to_out(
    message: Message,
    channel_name: str | None = None,
    current_user_id: int | None = None,
) -> MessageOut:
    reaction_counts: dict[str, int] = {}
    reacted_by_user: set[str] = set()
    for reaction in getattr(message, "reactions", []) or []:
        reaction_counts[reaction.emoji] = reaction_counts.get(reaction.emoji, 0) + 1
        if current_user_id is not None and reaction.user_id == current_user_id:
            reacted_by_user.add(reaction.emoji)

    return MessageOut(
        id=message.id,
        channel_id=message.channel_id,
        sender_id=message.sender_id,
        content=message.content,
        created_at=message.created_at,
        edited_at=message.edited_at,
        sender=UserOut.model_validate(message.sender),
        channel_name=channel_name,
        reactions=[
            ReactionOut(emoji=emoji, count=count, user_reacted=emoji in reacted_by_user)
            for emoji, count in reaction_counts.items()
        ],
    )


async def get_member_channel(channel_id: int, user_id: int, db: AsyncSession) -> Channel | None:
    result = await db.execute(
        select(Channel)
        .join(ChannelMember, ChannelMember.channel_id == Channel.id)
        .where(and_(Channel.id == channel_id, ChannelMember.user_id == user_id))
    )
    return result.scalar_one_or_none()


async def get_read_state(db: AsyncSession, user_id: int, channel_id: int) -> ChannelReadState | None:
    result = await db.execute(
        select(ChannelReadState).where(
            ChannelReadState.user_id == user_id,
            ChannelReadState.channel_id == channel_id,
        )
    )
    return result.scalar_one_or_none()


async def get_unread_count(
    db: AsyncSession, user_id: int, channel_id: int, last_read_message_id: int | None
) -> int:
    query = select(func.count(Message.id)).where(
        Message.channel_id == channel_id,
        Message.sender_id != user_id,
    )
    if last_read_message_id is not None:
        query = query.where(Message.id > last_read_message_id)
    result = await db.execute(query)
    return result.scalar_one()


async def get_last_message(db: AsyncSession, channel_id: int) -> Message | None:
    result = await db.execute(
        select(Message)
        .where(Message.channel_id == channel_id)
        .options(selectinload(Message.sender))
        .order_by(Message.id.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def channel_to_out(db: AsyncSession, channel: Channel, user_id: int) -> ChannelOut:
    read_state = await get_read_state(db, user_id, channel.id)
    last_read_id = read_state.last_read_message_id if read_state else None
    unread_count = await get_unread_count(db, user_id, channel.id, last_read_id)
    last_message = await get_last_message(db, channel.id)

    return ChannelOut(
        id=channel.id,
        name=channel.name,
        slug=channel.slug,
        description=channel.description,
        is_direct_message=channel.is_direct_message,
        created_at=channel.created_at,
        members=[UserOut.model_validate(member.user) for member in channel.members],
        unread_count=unread_count,
        last_read_message_id=last_read_id,
        last_message=message_to_out(last_message, current_user_id=user_id) if last_message else None,
    )


async def mark_channel_read(db: AsyncSession, user_id: int, channel_id: int, message_id: int | None = None):
    if message_id is None:
        last_message = await get_last_message(db, channel_id)
        message_id = last_message.id if last_message else None

    read_state = await get_read_state(db, user_id, channel_id)
    if read_state is None:
        read_state = ChannelReadState(
            user_id=user_id,
            channel_id=channel_id,
            last_read_message_id=message_id,
        )
        db.add(read_state)
    else:
        if message_id is not None and (
            read_state.last_read_message_id is None or message_id > read_state.last_read_message_id
        ):
            read_state.last_read_message_id = message_id
        read_state.updated_at = datetime.now(timezone.utc)

    await db.commit()


def extract_mentions(content: str) -> list[str]:
    return list(dict.fromkeys(MENTION_PATTERN.findall(content)))


async def create_mention_notifications(
    db: AsyncSession,
    message: Message,
    sender: User,
    content: str,
) -> list[Notification]:
    usernames = extract_mentions(content)
    if not usernames:
        return []

    result = await db.execute(select(User).where(User.username.in_(usernames)))
    mentioned_users = result.scalars().all()
    notifications: list[Notification] = []

    for mentioned in mentioned_users:
        if mentioned.id == sender.id:
            continue
        member_check = await db.execute(
            select(ChannelMember).where(
                ChannelMember.channel_id == message.channel_id,
                ChannelMember.user_id == mentioned.id,
            )
        )
        if member_check.scalar_one_or_none() is None:
            continue

        preview = content if len(content) <= 200 else content[:197] + "..."
        notification = Notification(
            user_id=mentioned.id,
            channel_id=message.channel_id,
            message_id=message.id,
            actor_id=sender.id,
            type=NotificationType.mention,
            content=f"{sender.display_name} te mencionó: {preview}",
            is_read=False,
        )
        db.add(notification)
        notifications.append(notification)

    if notifications:
        await db.commit()
        for notification in notifications:
            await db.refresh(notification)

    return notifications


def notification_to_out(notification: Notification, actor: User | None = None) -> NotificationOut:
    return NotificationOut(
        id=notification.id,
        user_id=notification.user_id,
        channel_id=notification.channel_id,
        message_id=notification.message_id,
        actor_id=notification.actor_id,
        actor_display_name=actor.display_name if actor else None,
        type=notification.type,
        content=notification.content,
        is_read=notification.is_read,
        created_at=notification.created_at,
    )


async def emit_new_message(message: Message, exclude_user_id: int | None = None):
    message_out = message_to_out(message)
    await manager.broadcast_to_channel(
        message.channel_id,
        {
            "type": "new_message",
            "channel_id": int(message.channel_id),
            "message": message_out.model_dump(mode="json"),
        },
        exclude_user_id=exclude_user_id,
    )


async def emit_notification(notification: Notification, actor: User):
    payload = notification_to_out(notification, actor).model_dump(mode="json")
    await manager.send_to_user(
        notification.user_id,
        {"type": "notification", "notification": payload},
    )


async def find_or_create_dm(db: AsyncSession, current_user: User, other_user: User) -> Channel:
    if current_user.id == other_user.id:
        raise ValueError("No puedes abrir un DM contigo mismo")

    slug = f"dm-{min(current_user.id, other_user.id)}-{max(current_user.id, other_user.id)}"
    result = await db.execute(
        select(Channel)
        .where(Channel.slug == slug, Channel.is_direct_message.is_(True))
        .options(selectinload(Channel.members).selectinload(ChannelMember.user))
    )
    channel = result.scalar_one_or_none()
    if channel:
        return channel

    channel = Channel(
        name=f"{current_user.display_name} · {other_user.display_name}",
        slug=slug,
        description="Mensaje directo",
        is_direct_message=True,
    )
    db.add(channel)
    await db.flush()
    db.add(ChannelMember(channel_id=channel.id, user_id=current_user.id))
    db.add(ChannelMember(channel_id=channel.id, user_id=other_user.id))
    await db.commit()

    await manager.refresh_channel_memberships(db)

    result = await db.execute(
        select(Channel)
        .where(Channel.id == channel.id)
        .options(selectinload(Channel.members).selectinload(ChannelMember.user))
    )
    return result.scalar_one()


async def search_messages(db: AsyncSession, user_id: int, query: str, limit: int = 20):
    pattern = f"%{query}%"
    result = await db.execute(
        select(Message, Channel)
        .join(Channel, Channel.id == Message.channel_id)
        .join(ChannelMember, ChannelMember.channel_id == Channel.id)
        .where(
            ChannelMember.user_id == user_id,
            Message.content.ilike(pattern),
        )
        .options(selectinload(Message.sender))
        .order_by(Message.created_at.desc())
        .limit(limit)
    )
    return result.all()


async def search_channels(db: AsyncSession, user_id: int, query: str, limit: int = 10):
    pattern = f"%{query}%"
    result = await db.execute(
        select(Channel)
        .join(ChannelMember, ChannelMember.channel_id == Channel.id)
        .where(
            ChannelMember.user_id == user_id,
            or_(Channel.name.ilike(pattern), Channel.description.ilike(pattern)),
        )
        .options(selectinload(Channel.members).selectinload(ChannelMember.user))
        .limit(limit)
    )
    return result.scalars().unique().all()


async def search_users(db: AsyncSession, current_user_id: int, query: str, limit: int = 10):
    pattern = f"%{query}%"
    result = await db.execute(
        select(User)
        .where(
            User.id != current_user_id,
            or_(User.username.ilike(pattern), User.display_name.ilike(pattern)),
        )
        .limit(limit)
    )
    return result.scalars().all()
