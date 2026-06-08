from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select

from auth import get_user_from_token
from connection_manager import manager
from database import async_session
from models import User

router = APIRouter(tags=["websocket"])


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str):
    async with async_session() as db:
        user = await get_user_from_token(token, db)
        if user is None:
            await websocket.accept()
            await websocket.close(code=1008, reason="Token inválido")
            return

        await manager.refresh_channel_memberships(db)

        user_id = user.id
        display_name = user.display_name

        was_offline = not manager.is_user_online(user_id)
        user.is_online = True
        await db.commit()

    became_online = await manager.connect(user_id, websocket)
    if became_online or was_offline:
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
        fully_offline = manager.disconnect(user_id, websocket)

        if fully_offline:
            async with async_session() as session:
                result = await session.execute(select(User).where(User.id == user_id))
                db_user = result.scalar_one_or_none()
                if db_user:
                    db_user.is_online = False
                    await session.commit()

            await manager.broadcast({"type": "user_offline", "user_id": user_id})
