# FieldOps Nexus

Internal workforce visibility & coordination platform. A monorepo with three surfaces on one backend.

**Repo:** [github.com/Kiran-Veritech/fieldOps](https://github.com/Kiran-Veritech/fieldOps)

```
FieldOps/
├── backend/          FastAPI + MongoDB (Motor) — REST API under /api/v1
├── admin/            React + Vite + TypeScript + Tailwind v4 — ops admin panel
├── app/              Expo SDK 57 / React Native — field employee app
└── docker-compose.yml  Local MongoDB 7
```

## What you get

### Admin panel (web)
Dashboard · Live Map · Users · Projects (+ AI task generation review) · Tasks · Assets approval queue · Audit Log · Settings. Matches `design-reference/` screens.

### Field app (mobile)
Onboarding → register (domain allow-list) → location consent → capturing → **Home** (presence + task summary) · **Tasks** (list + detail + blocked reason) · **Assets** (list + enlist + photo) · **Profile** (sharing toggle + logout).

### Backend rules (hard product constraints)
- Location ping every **10s** while the app is foregrounded; **online** if last ping ≤ **60s** (derived, never stored).
- Rejecting an asset requires an **admin note**; marking a task **BLOCKED** requires a **reason**.
- AI-generated tasks stay **drafts** until a human commits them.

---

## Toolchain

| Tool    | Version              | Notes                          |
| ------- | -------------------- | ------------------------------ |
| Node    | 22 LTS (nvm)         | `.nvmrc` at repo root          |
| Python  | 3.12                 | `backend/.venv`                |
| MongoDB | 7 (Docker)           | `localhost:27017`              |
| Expo    | SDK 57 / RN 0.86     | React 19                       |

## Prerequisites

- [nvm](https://github.com/nvm-sh/nvm) + Node 22
- Python 3.12 (`brew install python@3.12`)
- Docker Desktop (running)

---

## Quick start

```bash
# 0) Database
docker compose up -d

# 1) Backend (port 8000)
cd backend
# first time only:
#   /opt/homebrew/bin/python3.12 -m venv .venv
#   ./.venv/bin/pip install -r requirements.txt
#   cp .env.example .env   # if needed
./.venv/bin/python seed.py
./.venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 2) Admin (port 5173)
cd admin && nvm use && npm install && npm run dev
# → http://localhost:5173

# 3) Field app
cd app && nvm use && npm install && npx expo start
# press i / a / w, or Expo Go (needs SDK 57-compatible Expo Go)
```

Optional presence simulator (keeps Live Map “online” without the phone):

```bash
cd backend && ./.venv/bin/python simulate_presence.py
```

---

## Demo credentials

| Role     | Email                    | Password     |
| -------- | ------------------------ | ------------ |
| Admin    | `tara.singh@fieldops.io` | `FieldOps!23` |
| Employees | any seeded `@fieldops.io` user | `FieldOps!23` |

Approved registration domain (configurable): **`fieldops.io`** (`APPROVED_EMAIL_DOMAINS` in `backend/.env`).

---

## Configuration

| App     | File / var | Default |
| ------- | ---------- | ------- |
| Backend | `backend/.env` — `MONGODB_URI`, `JWT_SECRET`, `APPROVED_EMAIL_DOMAINS`, `CORS_ORIGINS` | see `.env.example` |
| Admin   | `VITE_API_URL` | `http://localhost:8000` (client appends `/api/v1`) |
| Field app | `EXPO_PUBLIC_API_URL` | `http://localhost:8000` (client appends `/api/v1`) |

On a **physical device**, set `EXPO_PUBLIC_API_URL` to your machine’s LAN IP (e.g. `http://192.168.0.217:8000`). Simulator/web can use `localhost`.

API docs: http://localhost:8000/docs · Health: http://localhost:8000/health

---

## API overview (`/api/v1`)

| Area | Endpoints |
| ---- | --------- |
| Auth | `POST /auth/register`, `/login`, `/refresh` · `GET /auth/domains` |
| Presence | `POST /pings` · `GET /me` |
| Users | `GET/PATCH /users…` (admin) |
| Projects | CRUD + members · `generate-tasks` (draft) · `tasks/commit` |
| Employee helpers | `GET /projects/mine` · `GET /assets/mine` |
| Tasks | `GET /tasks` · `PATCH /tasks/{id}` (blocked needs reason) |
| Assets | `POST /assets` (multipart) · admin `PATCH …/decision` (reject needs note) |
| Ops | `GET /audit` · `GET /dashboard/summary` |

Every admin write records an `auditLog` entry. Uploads served at `/uploads`.

AI generation is stubbed in `backend/app/ai.py` (`call_ai_model()`); timeout via `FIELDOPS_AI_TIMEOUT` (default 30s).

---

## Design fidelity

Admin and field UIs follow a locked design system (navy command workspace, IBM Plex, §6 colour tokens). Do not restyle against a generic component library look.

---

## Scripts worth knowing

```bash
# Reset demo data
cd backend && ./.venv/bin/python seed.py

# Keep a rotating subset of users “online” for Live Map demos
cd backend && ./.venv/bin/python simulate_presence.py

# Admin production build
cd admin && npm run build

# Field app web export (fallback when Expo Go SDK mismatches)
cd app && npx expo export --platform web
```
