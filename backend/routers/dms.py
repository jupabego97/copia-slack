from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_current_user
from database import get_db
from models import User
from schemas import ChannelOut
from services.chat import channel_to_out, find_or_create_dm

router = APIRouter(prefix="/api/users", tags=["dms"])


@router.post("/{user_id}/dm", response_model=ChannelOut)
async def open_dm(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No puedes abrir un DM contigo mismo")

    result = await db.execute(select(User).where(User.id == user_id))
    other_user = result.scalar_one_or_none()
    if other_user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")

    try:
        channel = await find_or_create_dm(db, current_user, other_user)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return await channel_to_out(db, channel, current_user.id)
