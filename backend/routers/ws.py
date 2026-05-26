from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_user_from_token
from connection_manager import manager
from database import async_session
from models import ChannelMember, User

router = APIRouter(tags=["websocket"])


async def _load_channel_memberships(db: AsyncSession):
    result = await db.execute(select(ChannelMember))
    memberships = result.scalars().all()
    channel_map: dict[int, set[int]] = {}
    for membership in memberships:
        channel_map.setdefault(membership.channel_id, set()).add(membership.user_id)
    for channel_id, user_ids in channel_map.items():
        manager.register_channel_members(channel_id, user_ids)


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str):
    async with async_session() as db:
        user = await get_user_from_token(token, db)
        if user is None:
            await websocket.accept()
            await websocket.close(code=1008, reason="Token inválido")
            return

        await _load_channel_memberships(db)

        user_id = user.id
        display_name = user.display_name

        user.is_online = True
        await db.commit()

    await manager.connect(user_id, websocket)
    await manager.broadcast({"type": "user_online", "user_id": user_id}, exclude_user_id=user_id)

    try:
        while True:
            data = await websocket.receive_json()
            event_type = data.get("type")

            if event_type == "typing":
                channel_id = data.get("channel_id")
                if channel_id is not None:
                    await manager.broadcast_to_channel(
                        int(channel_id),
                        {
                            "type": "typing",
                            "channel_id": int(channel_id),
                            "user_id": user_id,
                            "display_name": display_name,
                        },
                        exclude_user_id=user_id,
                    )
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(user_id)

        async with async_session() as session:
            result = await session.execute(select(User).where(User.id == user_id))
            db_user = result.scalar_one_or_none()
            if db_user:
                db_user.is_online = False
                await session.commit()

        await manager.broadcast({"type": "user_offline", "user_id": user_id})
