from datetime import datetime

from pydantic import BaseModel, ConfigDict

from models import UserRole


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


class LoginRequest(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    display_name: str
    role: UserRole
    is_online: bool
    created_at: datetime


class ChannelOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    description: str | None
    is_direct_message: bool
    created_at: datetime
    members: list[UserOut] = []


class MessageCreate(BaseModel):
    content: str


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    channel_id: int
    sender_id: int
    content: str
    created_at: datetime
    edited_at: datetime | None
    sender: UserOut


Token.model_rebuild()
