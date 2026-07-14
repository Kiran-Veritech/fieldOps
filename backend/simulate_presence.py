"""Dev-only presence simulator — makes the Live Map look alive.

There's no mobile app pinging in a local demo, so every operator decays to
OFFLINE after 60s. This script stands in for the field app: every cycle it
records a real ping (same path as POST /pings) for a rotating subset of
operators, nudging their location slightly so pins drift like live GPS.

Run it alongside the backend:

    cd backend
    ./.venv/bin/python simulate_presence.py            # ~65% online, 20s cycle
    ./.venv/bin/python simulate_presence.py --ratio 0.8 --interval 15

Stop it with Ctrl-C; operators return to OFFLINE within 60s (the presence rule).
"""

from __future__ import annotations

import argparse
import asyncio
import random
import signal

from app.db import close_mongo_connection, connect_to_mongo, get_db
from app import repository as repo

# Keep in sync with the admin map projection + seed.
NCR_BOUNDS = {"minLat": 28.40, "maxLat": 28.72, "minLng": 76.98, "maxLng": 77.34}


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def _drift(lat: float, lng: float) -> tuple[float, float]:
    """Nudge a position a few hundred metres so pins move like live GPS."""
    return (
        round(_clamp(lat + random.uniform(-0.004, 0.004), NCR_BOUNDS["minLat"], NCR_BOUNDS["maxLat"]), 6),
        round(_clamp(lng + random.uniform(-0.004, 0.004), NCR_BOUNDS["minLng"], NCR_BOUNDS["maxLng"]), 6),
    )


def _scatter() -> tuple[float, float]:
    return (
        round(random.uniform(NCR_BOUNDS["minLat"], NCR_BOUNDS["maxLat"]), 6),
        round(random.uniform(NCR_BOUNDS["minLng"], NCR_BOUNDS["maxLng"]), 6),
    )


async def _load_employees() -> list[dict]:
    cursor = get_db().users.find({"role": "employee", "status": "active"})
    return [u async for u in cursor]


async def run(ratio: float, interval: float) -> None:
    await connect_to_mongo()
    users = await _load_employees()
    if not users:
        print("No active employees found — run seed.py first.")
        await close_mongo_connection()
        return

    ids = [u["_id"] for u in users]
    last_loc = {u["_id"]: u.get("lastLocation") or u.get("initialLocation") for u in users}
    online = set(random.sample(ids, k=max(1, round(len(ids) * ratio))))

    stopping = asyncio.Event()

    def _stop(*_: object) -> None:
        stopping.set()

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            asyncio.get_running_loop().add_signal_handler(sig, _stop)
        except NotImplementedError:  # pragma: no cover (Windows)
            pass

    print(
        f"Simulating presence for {len(online)}/{len(ids)} operators "
        f"every {interval:.0f}s. Ctrl-C to stop (they go offline within 60s)."
    )

    cycle = 0
    while not stopping.is_set():
        # Small churn so ONLINE/OFFLINE counts move between cycles.
        if cycle and random.random() < 0.5:
            leaving = random.choice(list(online)) if online else None
            joining = random.choice([i for i in ids if i not in online] or ids)
            if leaving:
                online.discard(leaving)
            online.add(joining)

        for uid in list(online):
            loc = last_loc.get(uid)
            lat, lng = _drift(loc["lat"], loc["lng"]) if loc else _scatter()
            last_loc[uid] = {"lat": lat, "lng": lng}
            await repo.record_ping(uid, lat, lng)

        print(f"cycle {cycle}: pinged {len(online)} operators")
        cycle += 1
        try:
            await asyncio.wait_for(stopping.wait(), timeout=interval)
        except asyncio.TimeoutError:
            pass

    await close_mongo_connection()
    print("Stopped. Operators will read OFFLINE within 60s.")


def main() -> None:
    parser = argparse.ArgumentParser(description="FieldOps Nexus presence simulator (dev only).")
    parser.add_argument("--ratio", type=float, default=0.65, help="fraction of operators kept online (0-1)")
    parser.add_argument("--interval", type=float, default=20.0, help="seconds between ping cycles")
    args = parser.parse_args()
    asyncio.run(run(_clamp(args.ratio, 0.05, 1.0), max(5.0, args.interval)))


if __name__ == "__main__":
    main()
