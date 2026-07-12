import os

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase


def get_database_url() -> str:
    """Resolve and normalize DB URL for SQLAlchemy async drivers."""
    url = (
        os.getenv("DATABASE_URL")
        or os.getenv("DATABASE_PUBLIC_URL")
        or os.getenv("POSTGRES_URL")
    )

    if not url:
        # Local demo fallback when PostgreSQL is not configured
        return "sqlite+aiosqlite:///./nanotronics_chat.db"

    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)

    return url


DATABASE_URL = get_database_url()

_connect_args: dict = {}
_engine_kwargs: dict = {
    "echo": False,
    "pool_pre_ping": True,
}

if DATABASE_URL.startswith("sqlite"):
    _connect_args["check_same_thread"] = False
elif any(token in DATABASE_URL for token in ("railway.app", "rlwy.net", "sslmode=require")):
    _connect_args["ssl"] = "require"

engine = create_async_engine(
    DATABASE_URL,
    connect_args=_connect_args,
    **_engine_kwargs,
)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()
