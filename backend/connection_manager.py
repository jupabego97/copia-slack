from typing import Dict, Set

from fastapi import WebSocket
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import ChannelMember


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, Set[WebSocket]] = {}
        self.channel_members: Dict[int, Set[int]] = {}

    def register_channel_members(self, channel_id: int, user_ids: Set[int]):
        self.channel_members[channel_id] = user_ids

    async def refresh_channel_memberships(self, db: AsyncSession):
        result = await db.execute(select(ChannelMember))
        memberships = result.scalars().all()
        self.channel_members.clear()
        for membership in memberships:
            self.channel_members.setdefault(membership.channel_id, set()).add(membership.user_id)

    def is_user_online(self, user_id: int) -> bool:
        return bool(self.active_connections.get(user_id))

    async def connect(self, user_id: int, websocket: WebSocket) -> bool:
        await websocket.accept()
        connections = self.active_connections.setdefault(user_id, set())
        was_offline = len(connections) == 0
        connections.add(websocket)
        return was_offline

    def disconnect(self, user_id: int, websocket: WebSocket) -> bool:
        connections = self.active_connections.get(user_id)
        if not connections:
            return True
        connections.discard(websocket)
        if not connections:
            self.active_connections.pop(user_id, None)
            return True
        return False

    async def send_to_user(self, user_id: int, message: dict):
        for websocket in list(self.active_connections.get(user_id, set())):
            try:
                await websocket.send_json(message)
            except Exception:
                self.disconnect(user_id, websocket)

    async def broadcast(self, message: dict, exclude_user_id: int | None = None):
        for user_id in list(self.active_connections.keys()):
            if exclude_user_id is not None and user_id == exclude_user_id:
                continue
            await self.send_to_user(user_id, message)

    async def broadcast_to_channel(
        self,
        channel_id: int,
        message: dict,
        exclude_user_id: int | None = None,
    ):
        members = self.channel_members.get(channel_id, set())
        for user_id in members:
            if exclude_user_id is not None and user_id == exclude_user_id:
                continue
            await self.send_to_user(user_id, message)


manager = ConnectionManager()
