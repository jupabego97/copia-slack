from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_current_user
from database import get_db
from models import User
from schemas import ChannelOut, SearchResults, UserOut
from services.chat import channel_to_out, message_to_out, search_channels, search_messages, search_users

router = APIRouter(prefix="/api/search", tags=["search"])


@router.get("", response_model=SearchResults)
async def search(
    q: str = Query(min_length=1, max_length=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = q.strip()
    channels = await search_channels(db, current_user.id, query)
    users = await search_users(db, current_user.id, query)
    message_rows = await search_messages(db, current_user.id, query)

    return SearchResults(
        channels=[await channel_to_out(db, channel, current_user.id) for channel in channels],
        users=[UserOut.model_validate(user) for user in users],
        messages=[message_to_out(message, channel.name, current_user.id) for message, channel in message_rows],
    )
