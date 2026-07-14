from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import settings
from .db import close_mongo_connection, connect_to_mongo, ensure_indexes, ping_database
from .routers import assets, audit, auth, dashboard, presence, projects, tasks, users

API_PREFIX = "/api/v1"
UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_to_mongo()
    await ensure_indexes()
    yield
    await close_mongo_connection()


app = FastAPI(title="FieldOps Nexus API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    # Dev convenience: also allow app web builds served through a Cloudflare
    # quick tunnel (*.trycloudflare.com). The specific origin is echoed back,
    # so this stays compatible with allow_credentials.
    allow_origin_regex=r"https://.*\.trycloudflare\.com",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(presence.router, prefix=API_PREFIX)
app.include_router(users.router, prefix=API_PREFIX)
app.include_router(projects.router, prefix=API_PREFIX)
app.include_router(tasks.router, prefix=API_PREFIX)
app.include_router(assets.router, prefix=API_PREFIX)
app.include_router(audit.router, prefix=API_PREFIX)
app.include_router(dashboard.router, prefix=API_PREFIX)

# Serve uploaded asset photos.
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


@app.get("/health")
async def health() -> dict:
    db_ok = await ping_database()
    return {
        "status": "ok" if db_ok else "degraded",
        "service": "fieldops-nexus-api",
        "database": "up" if db_ok else "down",
        "time": datetime.now(timezone.utc).isoformat(),
    }
