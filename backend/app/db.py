import pymongo
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from .config import settings


class Database:
    client: AsyncIOMotorClient | None = None
    db: AsyncIOMotorDatabase | None = None


mongo = Database()


def get_db() -> AsyncIOMotorDatabase:
    if mongo.db is None:
        raise RuntimeError("MongoDB is not connected. Call connect_to_mongo() first.")
    return mongo.db


async def connect_to_mongo() -> None:
    mongo.client = AsyncIOMotorClient(settings.mongodb_uri)
    mongo.db = mongo.client[settings.mongodb_db]


async def ensure_indexes() -> None:
    """Create the indexes listed in §2 of BUILD_PROMPT. Idempotent."""
    db = get_db()
    await db.users.create_index("workEmail", unique=True, name="uq_users_workEmail")
    await db.users.create_index("lastPingAt", name="ix_users_lastPingAt")
    await db.pings.create_index(
        [("userId", pymongo.ASCENDING), ("at", pymongo.DESCENDING)],
        name="ix_pings_userId_at",
    )
    await db.tasks.create_index("projectId", name="ix_tasks_projectId")
    await db.assets.create_index("status", name="ix_assets_status")
    await db.auditLog.create_index("at", name="ix_auditLog_at")


async def close_mongo_connection() -> None:
    if mongo.client is not None:
        mongo.client.close()
        mongo.client = None
        mongo.db = None


async def ping_database() -> bool:
    """Return True if the MongoDB server responds to a ping."""
    if mongo.client is None:
        return False
    try:
        await mongo.client.admin.command("ping")
        return True
    except Exception:
        return False
