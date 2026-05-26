from typing import Dict, Set

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, WebSocket] = {}
        self.channel_members: Dict[int, Set[int]] = {}

    def register_channel_members(self, channel_id: int, user_ids: Set[int]):
        self.channel_members[channel_id] = user_ids

    async def connect(self, user_id: int, websocket: WebSocket):
        previous = self.active_connections.get(user_id)
        if previous is not None and previous is not websocket:
            try:
                await previous.close()
            except Exception:
                pass

        await websocket.accept()
        self.active_connections[user_id] = websocket

    def disconnect(self, user_id: int):
        self.active_connections.pop(user_id, None)

    async def send_to_user(self, user_id: int, message: dict):
        websocket = self.active_connections.get(user_id)
        if websocket:
            await websocket.send_json(message)

    async def broadcast(self, message: dict, exclude_user_id: int | None = None):
        for user_id, websocket in list(self.active_connections.items()):
            if exclude_user_id is not None and user_id == exclude_user_id:
                continue
            try:
                await websocket.send_json(message)
            except Exception:
                self.disconnect(user_id)

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
