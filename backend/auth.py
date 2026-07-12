import os
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import User

_INSECURE_DEFAULTS = {"change-me-in-production", "nanotronics-dev-secret", "nanotronics-dev-secret-change-in-production"}
SECRET_KEY = os.getenv("SECRET_KEY", "change-me-in-production")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)

# Simple in-memory login rate limit: max attempts per IP window
_LOGIN_ATTEMPTS: dict[str, list[float]] = defaultdict(list)
_LOGIN_MAX_ATTEMPTS = 8
_LOGIN_WINDOW_SECONDS = 60


def assert_secure_secret() -> None:
    """Warn when SECRET_KEY is unsafe; never block startup (Railway sets PORT)."""
    weak = SECRET_KEY in _INSECURE_DEFAULTS or len(SECRET_KEY) < 32
    if not weak:
        return
    print(
        "ADVERTENCIA: SECRET_KEY insegura o corta. "
        "En Railway → Variables del servicio web, define por ejemplo:\n"
        "  SECRET_KEY=<clave-aleatoria-de-al-menos-32-caracteres>\n"
        "Sin una clave propia, los tokens JWT no serán confiables en producción."
    )


def check_login_rate_limit(client_key: str) -> None:
    now = time.time()
    window_start = now - _LOGIN_WINDOW_SECONDS
    attempts = [t for t in _LOGIN_ATTEMPTS[client_key] if t >= window_start]
    _LOGIN_ATTEMPTS[client_key] = attempts
    if len(attempts) >= _LOGIN_MAX_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Demasiados intentos de login. Espera un minuto e intenta de nuevo.",
        )


def record_login_attempt(client_key: str) -> None:
    _LOGIN_ATTEMPTS[client_key].append(time.time())


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "exp": int(expire.timestamp())}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


async def get_user_from_token(token: str, db: AsyncSession) -> User | None:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload.get("sub"))
    except (JWTError, TypeError, ValueError):
        return None

    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No autenticado")

    user = await get_user_from_token(credentials.credentials, db)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")
    return user
