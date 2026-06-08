import asyncio
import os
import sys

from sqlalchemy import delete, select, text

from auth import get_password_hash
from connection_manager import manager
from database import DATABASE_URL, Base, async_session, engine
from models import (
    Channel,
    ChannelMember,
    ChannelReadState,
    Message,
    Notification,
    User,
    UserRole,
)

DEFAULT_PASSWORD = "nanotronics123"

USERS = [
    {"username": "juan", "display_name": "Juan Pérez", "role": UserRole.gerencia},
    {"username": "carlos", "display_name": "Carlos Ruiz", "role": UserRole.tecnico},
    {"username": "laura", "display_name": "Laura Gómez", "role": UserRole.marketing},
    {"username": "miguel", "display_name": "Miguel Ángel", "role": UserRole.compras},
    {"username": "sofia", "display_name": "Sofía Martínez", "role": UserRole.ventas},
    {"username": "andres", "display_name": "Andrés López", "role": UserRole.ventas},
]

CHANNELS = [
    {
        "name": "general",
        "slug": "general",
        "description": "Canal general de Nanotronics",
        "members": ["juan", "carlos", "laura", "miguel", "sofia", "andres"],
        "messages": [
            ("juan", "Bienvenidos al chat interno de Nanotronics. Aquí coordinamos todo el equipo."),
            ("sofia", "Perfecto, ya estoy conectada desde la tienda."),
            ("carlos", "Yo reviso reparaciones por #tecnico."),
        ],
    },
    {
        "name": "ventas",
        "slug": "ventas",
        "description": "Coordinación del equipo de ventas",
        "members": ["juan", "sofia", "andres"],
        "messages": [
            ("juan", "Meta de la semana: cerrar 12 equipos reacondicionados."),
            ("sofia", "Tengo 3 clientes calientes para hoy. @andres me ayudas con cotizaciones?"),
        ],
    },
    {
        "name": "tecnico",
        "slug": "tecnico",
        "description": "Soporte y reparaciones técnicas",
        "members": ["juan", "carlos"],
        "messages": [
            ("carlos", "MacBook Pro 2019 en diagnóstico. Posible falla en placa lógica."),
            ("juan", "Prioriza esa reparación, cliente corporativo."),
        ],
    },
    {
        "name": "compras",
        "slug": "compras",
        "description": "Proveedores e inventario",
        "members": ["juan", "miguel"],
        "messages": [
            ("miguel", "Proveedor confirmó despacho de pantallas para el jueves."),
        ],
    },
    {
        "name": "marketing",
        "slug": "marketing",
        "description": "Campañas y contenido",
        "members": ["juan", "laura"],
        "messages": [
            ("laura", "Nueva campaña de laptops reacondicionadas lista para revisión."),
        ],
    },
    {
        "name": "avisos",
        "slug": "avisos",
        "description": "Anuncios oficiales (solo gerencia escribe)",
        "members": ["juan", "carlos", "laura", "miguel", "sofia", "andres"],
        "messages": [
            ("juan", "Recuerden cerrar caja y registrar ventas antes de salir."),
        ],
    },
]

DIRECT_MESSAGES = [
    ("juan", "carlos"),
    ("juan", "sofia"),
    ("sofia", "andres"),
]


def _mask_database_url(url: str) -> str:
    if "@" not in url:
        return url
    prefix, host_part = url.split("@", 1)
    if "://" in prefix:
        scheme, _ = prefix.split("://", 1)
        return f"{scheme}://***@{host_part}"
    return url


async def wait_for_database(max_attempts: int = 20, delay_seconds: float = 1.5) -> None:
    for attempt in range(1, max_attempts + 1):
        try:
            async with engine.begin() as conn:
                await conn.execute(text("SELECT 1"))
            return
        except Exception as exc:
            if attempt == max_attempts:
                raise RuntimeError(
                    "No se pudo conectar a PostgreSQL después de varios intentos. "
                    f"DATABASE_URL={_mask_database_url(DATABASE_URL)}. "
                    "En Railway, vincula el servicio Postgres con "
                    "DATABASE_URL=${{Postgres.DATABASE_URL}} en el servicio web."
                ) from exc
            print(f"Esperando PostgreSQL... intento {attempt}/{max_attempts}")
            await asyncio.sleep(delay_seconds)


async def _populate_seed_data(db, force: bool = False) -> bool:
    existing = await db.execute(select(User).limit(1))
    if existing.scalar_one_or_none() and not force:
        print("Datos ya existen, omitiendo seed.")
        return False

    if force:
        await db.execute(delete(Notification))
        await db.execute(delete(ChannelReadState))
        await db.execute(delete(ChannelMember))
        await db.execute(delete(Message))
        await db.execute(delete(Channel))
        await db.execute(delete(User))
        await db.commit()

    user_map: dict[str, User] = {}
    password_hash = get_password_hash(DEFAULT_PASSWORD)

    for user_data in USERS:
        user = User(
            username=user_data["username"],
            display_name=user_data["display_name"],
            role=user_data["role"],
            hashed_password=password_hash,
            is_online=False,
        )
        db.add(user)
        user_map[user_data["username"]] = user

    await db.flush()

    channel_map: dict[str, Channel] = {}

    for channel_data in CHANNELS:
        channel = Channel(
            name=channel_data["name"],
            slug=channel_data["slug"],
            description=channel_data["description"],
            is_direct_message=False,
        )
        db.add(channel)
        await db.flush()
        channel_map[channel_data["slug"]] = channel

        for username in channel_data["members"]:
            db.add(ChannelMember(channel_id=channel.id, user_id=user_map[username].id))

        for author, content in channel_data.get("messages", []):
            db.add(
                Message(
                    channel_id=channel.id,
                    sender_id=user_map[author].id,
                    content=content,
                )
            )

    for user_a, user_b in DIRECT_MESSAGES:
        a = user_map[user_a]
        b = user_map[user_b]
        slug = f"dm-{min(a.id, b.id)}-{max(a.id, b.id)}"
        channel = Channel(
            name=f"{a.display_name} · {b.display_name}",
            slug=slug,
            description="Mensaje directo",
            is_direct_message=True,
        )
        db.add(channel)
        await db.flush()
        db.add(ChannelMember(channel_id=channel.id, user_id=a.id))
        db.add(ChannelMember(channel_id=channel.id, user_id=b.id))
        db.add(
            Message(
                channel_id=channel.id,
                sender_id=a.id,
                content=f"Hola {b.display_name.split()[0]}, coordinemos por aquí.",
            )
        )

    await db.commit()
    await manager.refresh_channel_memberships(db)
    print("Seed completado.")
    print(f"Contraseña inicial de todos los usuarios: {DEFAULT_PASSWORD}")
    return True


async def run_startup() -> None:
    if "localhost" in DATABASE_URL and not (
        os.getenv("DATABASE_URL")
        or os.getenv("DATABASE_PUBLIC_URL")
        or os.getenv("POSTGRES_URL")
    ):
        print("Advertencia: DATABASE_URL no configurada, usando localhost.")

    await wait_for_database()

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:
        await _populate_seed_data(db)


async def seed(force: bool = False):
    await wait_for_database()

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:
        await _populate_seed_data(db, force=force)


if __name__ == "__main__":
    force = "--force" in sys.argv
    asyncio.run(seed(force=force))
