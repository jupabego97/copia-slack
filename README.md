# Nanotronics Chat

Aplicación de mensajería interna tipo Slack para el equipo de **Nanotronics** (electrónica, Colombia).

Stack: React + Vite + TailwindCSS · FastAPI · PostgreSQL · WebSockets nativos · monolito (API + estáticos).

## Estructura

```
copia-slack/
├── backend/          # FastAPI + SQLAlchemy async
├── frontend/         # React (Vite)
├── docker-compose.yml
├── Dockerfile        # Multistage para Railway
└── README.md
```

## Variables de entorno

| Variable | Descripción | Ejemplo |
|---|---|---|
| `DATABASE_URL` | URL async de PostgreSQL | `postgresql+asyncpg://postgres:postgres@localhost:5432/nanotronics_chat` |
| `SECRET_KEY` | Clave JWT | `una-clave-segura-larga` |
| `ALGORITHM` | Algoritmo JWT | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Expiración del token | `480` |
| `ALLOWED_ORIGINS` | Orígenes CORS (coma) | `http://localhost:5173` |

Copia `.env.example` a `.env` en la raíz del proyecto para desarrollo local del backend.

## Usuarios demo (seed)

| Usuario | Rol |
|---|---|
| juan | gerencia |
| carlos | tecnico |
| laura | marketing |
| miguel | compras |
| sofia | ventas |
| andres | ventas |

Contraseña inicial de todos: `nanotronics123`

## Desarrollo sin Docker

### 1. PostgreSQL

Crea la base de datos:

```sql
CREATE DATABASE nanotronics_chat;
```

### 2. Backend

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt

set DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/nanotronics_chat
set SECRET_KEY=nanotronics-dev-secret
set ALGORITHM=HS256
set ACCESS_TOKEN_EXPIRE_MINUTES=480
set ALLOWED_ORIGINS=http://localhost:5173

python seed.py
uvicorn main:app --reload --port 8000
```

En PowerShell usa `$env:DATABASE_URL="..."` en lugar de `set`.

### 3. Frontend

En otra terminal:

```bash
cd frontend
npm install
npm run dev
```

Abre [http://localhost:5173](http://localhost:5173). Vite hace proxy de `/api` y `/ws` hacia el backend en el puerto 8000.

## Desarrollo con Docker Compose

```bash
docker compose up --build
```

Servicios:

- **db**: PostgreSQL 16 en `localhost:5432`
- **frontend-build**: construye React y deja `dist/` en un volumen
- **backend**: FastAPI en [http://localhost:8000](http://localhost:8000)

La primera vez, el backend ejecuta `seed.py` automáticamente (solo si la base está vacía).

## Deploy en Railway (un solo servicio)

El `Dockerfile` multistage:

1. Construye el frontend con Node 20
2. Copia `dist/` dentro de la imagen Python
3. Sirve API + SPA desde FastAPI

### Pasos

1. Sube este repo a GitHub (por ejemplo [jupabego97/copia-slack](https://github.com/jupabego97/copia-slack)).
2. En [Railway](https://railway.app), crea un proyecto nuevo.
3. Agrega un servicio **PostgreSQL**.
4. Agrega un servicio desde el repo GitHub y selecciona el `Dockerfile` de la raíz.
5. En el servicio **web** (no solo en Postgres), agrega estas variables:

```
DATABASE_URL=${{Postgres.DATABASE_URL}}
SECRET_KEY=genera-una-clave-larga-y-aleatoria
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480
ALLOWED_ORIGINS=https://tu-dominio.up.railway.app
```

> **Importante:** `DATABASE_URL` debe estar en el servicio web. Si falta, la app intentará conectar a `localhost:5432` y fallará.
> El backend convierte automáticamente `postgresql://` → `postgresql+asyncpg://`.

6. Expón el servicio web; Railway inyecta `PORT` automáticamente.
7. Al arrancar, FastAPI ejecuta el seed automáticamente en el lifespan (solo si la base está vacía) y luego levanta el servidor.

## API

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/auth/login` | Login JWT |
| GET | `/api/auth/me` | Usuario actual |
| GET | `/api/channels` | Canales del usuario |
| GET | `/api/channels/{id}/messages` | Historial paginado |
| POST | `/api/channels/{id}/messages` | Enviar mensaje |
| GET | `/api/users` | Usuarios y estado online |
| WS | `/ws?token=JWT` | Eventos en tiempo real |

## WebSocket

Eventos del servidor:

```json
{ "type": "new_message", "channel_id": 1, "message": { } }
{ "type": "user_online", "user_id": 2 }
{ "type": "user_offline", "user_id": 2 }
{ "type": "typing", "channel_id": 1, "user_id": 2, "display_name": "Carlos" }
```

Evento del cliente:

```json
{ "type": "typing", "channel_id": 1 }
```

## Canales seed

- `#general` — todos
- `#ventas` — juan, sofia, andres
- `#tecnico` — juan, carlos
- `#compras` — juan, miguel
- `#marketing` — juan, laura
- `#avisos` — todos (solo gerencia puede escribir)

También se crean DMs de ejemplo entre miembros del equipo.

## Licencia

Uso interno Nanotronics.
