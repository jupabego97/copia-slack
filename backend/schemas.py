from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from models import NotificationType, UserRole


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


class MessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=4000)


class MessageUpdate(BaseModel):
    content: str = Field(min_length=1, max_length=4000)


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    channel_id: int
    sender_id: int
    content: str
    created_at: datetime
    edited_at: datetime | None
    sender: UserOut


class ChannelOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    description: str | None
    is_direct_message: bool
    created_at: datetime
    members: list[UserOut] = []
    unread_count: int = 0
    last_message: MessageOut | None = None


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    channel_id: int
    message_id: int | None
    actor_id: int
    actor_display_name: str | None = None
    type: NotificationType
    content: str
    is_read: bool
    created_at: datetime


class SearchResults(BaseModel):
    channels: list[ChannelOut] = []
    users: list[UserOut] = []
    messages: list[MessageOut] = []


Token.model_rebuild()
