"""Dev-only presence simulator — makes the Live Map look alive.

Every cycle it records real pings (same path as POST /pings) for a rotating
subset of field operators, nudges their GPS slightly, and randomly flips people
online ↔ offline so the Live Map counters and pin halos visibly churn.

Run alongside the backend (after seed.py):

    cd backend
    ./.venv/bin/python simulate_presence.py
    ./.venv/bin/python simulate_presence.py --ratio 0.55 --interval 12 --churn 0.25

Stop with Ctrl-C; anyone not getting fresh pings goes OFFLINE within 60s.
"""

from __future__ import annotations

import argparse
import asyncio
import random
import signal

from app.db import close_mongo_connection, connect_to_mongo, get_db
from app import repository as repo

NCR_BOUNDS = {"minLat": 28.40, "maxLat": 28.72, "minLng": 76.98, "maxLng": 77.34}


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def _drift(lat: float, lng: float) -> tuple[float, float]:
    """Nudge a few hundred metres so pins drift like live GPS."""
    return (
        round(_clamp(lat + random.uniform(-0.0035, 0.0035), NCR_BOUNDS["minLat"], NCR_BOUNDS["maxLat"]), 6),
        round(_clamp(lng + random.uniform(-0.0035, 0.0035), NCR_BOUNDS["minLng"], NCR_BOUNDS["maxLng"]), 6),
    )


def _scatter() -> tuple[float, float]:
    return (
        round(random.uniform(NCR_BOUNDS["minLat"], NCR_BOUNDS["maxLat"]), 6),
        round(random.uniform(NCR_BOUNDS["minLng"], NCR_BOUNDS["maxLng"]), 6),
    )


async def _load_employees() -> list[dict]:
    cursor = get_db().users.find({"role": "employee", "status": "active"})
    return [u async for u in cursor]


def _label(users_by_id: dict[str, dict], uid: str) -> str:
    u = users_by_id.get(uid) or {}
    return u.get("fullName") or uid[:8]


async def run(ratio: float, interval: float, churn: float) -> None:
    await connect_to_mongo()
    users = await _load_employees()
    if not users:
        print("No active employees found — run seed.py first.")
        await close_mongo_connection()
        return

    users_by_id = {u["_id"]: u for u in users}
    ids = list(users_by_id.keys())
    last_loc = {
        u["_id"]: u.get("lastLocation") or u.get("initialLocation") for u in users
    }

    target = max(1, round(len(ids) * ratio))
    online: set[str] = set(random.sample(ids, k=min(target, len(ids))))

    stopping = asyncio.Event()

    def _stop(*_: object) -> None:
        stopping.set()

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            asyncio.get_running_loop().add_signal_handler(sig, _stop)
        except NotImplementedError:  # pragma: no cover (Windows)
            pass

    print(
        f"Presence simulator · {len(ids)} operators · target ~{ratio:.0%} online "
        f"· cycle {interval:.0f}s · churn {churn:.0%}"
    )
    print("Ctrl-C to stop (unpinged ops go offline within 60s).\n")

    cycle = 0
    while not stopping.is_set():
        # Refresh roster occasionally (re-seed mid-demo).
        if cycle and cycle % 10 == 0:
            users = await _load_employees()
            users_by_id = {u["_id"]: u for u in users}
            ids = list(users_by_id.keys())
            for u in users:
                last_loc.setdefault(
                    u["_id"], u.get("lastLocation") or u.get("initialLocation")
                )
            online &= set(ids)

        joined: list[str] = []
        left: list[str] = []

        # Random joins / leaves each cycle — keep near the target ratio.
        offline = [i for i in ids if i not in online]
        n_flip = max(1, round(len(ids) * churn))

        # Drop some currently-online people (they'll age out of the 60s window).
        if online and random.random() < 0.85:
            n_leave = min(len(online), max(1, random.randint(1, n_flip)))
            for uid in random.sample(list(online), k=n_leave):
                online.discard(uid)
                left.append(uid)

        # Bring some offline people online.
        if offline and random.random() < 0.9:
            n_join = min(len(offline), max(1, random.randint(1, n_flip)))
            for uid in random.sample(offline, k=n_join):
                online.add(uid)
                joined.append(uid)

        # Soft rebalance toward target size.
        while len(online) > target + 2 and online:
            uid = random.choice(list(online))
            online.discard(uid)
            if uid not in left:
                left.append(uid)
        while len(online) < max(1, target - 2):
            candidates = [i for i in ids if i not in online]
            if not candidates:
                break
            uid = random.choice(candidates)
            online.add(uid)
            if uid not in joined:
                joined.append(uid)

        for uid in list(online):
            loc = last_loc.get(uid)
            if loc and "lat" in loc and "lng" in loc:
                lat, lng = _drift(float(loc["lat"]), float(loc["lng"]))
            else:
                lat, lng = _scatter()
            last_loc[uid] = {"lat": lat, "lng": lng}
            await repo.record_ping(uid, lat, lng)

        j = ", ".join(_label(users_by_id, u) for u in joined[:4])
        l = ", ".join(_label(users_by_id, u) for u in left[:4])
        extra_j = f" +{len(joined) - 4}" if len(joined) > 4 else ""
        extra_l = f" +{len(left) - 4}" if len(left) > 4 else ""
        print(
            f"cycle {cycle:03d} · online {len(online):2d}/{len(ids)} · "
            f"↑ {j or '—'}{extra_j} · ↓ {l or '—'}{extra_l}"
        )

        cycle += 1
        try:
            await asyncio.wait_for(stopping.wait(), timeout=interval)
        except asyncio.TimeoutError:
            pass

    await close_mongo_connection()
    print("Stopped. Operators will read OFFLINE within 60s.")


def main() -> None:
    parser = argparse.ArgumentParser(description="FieldOps Nexus presence simulator (demo).")
    parser.add_argument(
        "--ratio",
        type=float,
        default=0.55,
        help="target fraction of employees kept online (0-1)",
    )
    parser.add_argument(
        "--interval",
        type=float,
        default=12.0,
        help="seconds between ping / churn cycles",
    )
    parser.add_argument(
        "--churn",
        type=float,
        default=0.22,
        help="fraction of roster that can flip online/offline each cycle",
    )
    args = parser.parse_args()
    asyncio.run(
        run(
            _clamp(args.ratio, 0.1, 1.0),
            max(5.0, args.interval),
            _clamp(args.churn, 0.05, 0.6),
        )
    )


if __name__ == "__main__":
    main()
