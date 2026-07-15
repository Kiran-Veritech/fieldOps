# Deploy FieldOps Nexus API on Render.com

This guide covers running the FastAPI backend locally and deploying it as a **Web Service** on [Render](https://render.com).

## Local start command

From the `backend/` directory (with the virtualenv activated):

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- App module: `app.main:app`
- Health check: [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)
- API base: [http://127.0.0.1:8000/api/v1](http://127.0.0.1:8000/api/v1)
- Docs: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

Copy `.env.example` → `.env` and fill in values before starting.

---

## Render start command

Use this as the **Start Command** on Render (do **not** use `--reload` in production):

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Render injects `$PORT`. Binding to `0.0.0.0` is required so the service accepts public traffic.

**Optional (recommended):** more workers for light concurrency:

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 2
```

On free tier, stick to a single worker to reduce memory use.

---

## Create the Render Web Service

1. Push this repo to GitHub/GitLab (Render deploys from git).
2. In Render Dashboard → **New** → **Web Service**.
3. Connect the repository.
4. Configure:

| Setting | Value |
|--------|--------|
| **Name** | `fieldops-nexus-api` (or any name) |
| **Region** | Closest to your users / Atlas cluster |
| **Root Directory** | `backend` |
| **Runtime** | `Python 3` |
| **Python version** | **3.12.8** (see below — do not use 3.14) |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| **Instance type** | Free or Starter |

### Python version (important)

This API pins packages (e.g. `pydantic==2.10.4`) that ship **prebuilt wheels for Python 3.12**, not for 3.14.

If Render picks Python **3.14**, `pip` tries to compile `pydantic-core` with Rust/`maturin` and fails with:

```text
Read-only file system (os error 30)
metadata-generation-failed → pydantic-core
```

**Fix — pin Python 3.12** (already in the repo under `backend/`):

- `runtime.txt` → `python-3.12.8`
- `.python-version` → `3.12.8`

Also set an Environment Variable on Render:

| Variable | Value |
|----------|--------|
| `PYTHON_VERSION` | `3.12.8` |

Then **Clear build cache** (or trigger a clean deploy) and redeploy.

5. Add **Environment Variables** (see below).
6. Set **Health Check Path** to `/health`.
7. Deploy.

After deploy, your public base URL looks like:

```text
https://fieldops-nexus-api.onrender.com
```

API prefix remains `/api/v1`, for example:

```text
https://fieldops-nexus-api.onrender.com/api/v1/auth/domains
https://fieldops-nexus-api.onrender.com/health
```

---

## Environment variables

Set these in Render → **Environment** (do not commit secrets).

| Variable | Required | Example / notes |
|----------|----------|-----------------|
| `MONGODB_URI` | Yes | Atlas connection string (`mongodb+srv://…`) |
| `MONGODB_DB` | Yes | e.g. `field-ops-ai` |
| `JWT_SECRET` | Yes | Long random string (not `dev-secret-change-me`) |
| `JWT_ALGORITHM` | No | `HS256` (default) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | `30` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | No | `7` |
| `APPROVED_EMAIL_DOMAINS` | Yes | e.g. `veritech.ai` |
| `CORS_ORIGINS` | Yes | Comma-separated admin/app web origins, e.g. `https://your-admin.vercel.app` |
| `RESEND_API_KEY` | Yes (for OTP email) | `re_…` from Resend |
| `RESEND_FROM_EMAIL` | No | e.g. `FieldOps Nexus <onboarding@resend.dev>` |
| `OTP_EXPIRE_MINUTES` | No | `10` |

Settings are loaded via `pydantic-settings` from environment variables (see `app/config.py`). Names match uppercase env keys (`MONGODB_URI`, `CORS_ORIGINS`, etc.).

---

## MongoDB Atlas checklist

1. Use Atlas (Render does not include MongoDB on free tiers by default).
2. Network Access → allow Render egress (simplest for demos: `0.0.0.0/0`).
3. Database user has read/write on `MONGODB_DB`.
4. Run `seed.py` once from a trusted machine if you need demo data:

```bash
cd backend
source .venv/bin/activate
# with MONGODB_URI / MONGODB_DB set to the production DB
python seed.py
```

---

## Point clients at Render

### Admin (Vite)

**Development** (`admin/.env`):

```bash
VITE_API_URL=http://localhost:8000
```

**Production** (`admin/.env.production` — used automatically by `npm run build`):

```bash
VITE_API_URL=https://fieldops-nexus.onrender.com
```

Build:

```bash
cd admin && npm run build
```

Output: `admin/dist/`. Add the admin hosting origin to `CORS_ORIGINS` on Render
(e.g. `https://your-admin.vercel.app` or `http://localhost:4173` for `vite preview`).

### Mobile app (Expo)

**Development** (`app/.env`):

```bash
EXPO_PUBLIC_API_URL=http://localhost:8000
```

**Production** (`app/.env.production` — used for release / production APK builds):

```bash
EXPO_PUBLIC_API_URL=https://fieldops-nexus.onrender.com
```

The app appends `/api/v1` itself. Rebuild the release APK after changing production env.

---

## Free-tier notes

- Services **spin down** after idle time; the first request can take ~30–60s to wake.
- Keep `JWT_SECRET` stable across deploys or all existing tokens become invalid.
- Uploaded files under `uploads/` live on the container filesystem and are **ephemeral** on Render free/starter disks—persist to S3/R2 if you need durable photo storage.

---

## Quick verify after deploy

```bash
curl -s https://YOUR-SERVICE.onrender.com/health
curl -s https://YOUR-SERVICE.onrender.com/api/v1/auth/domains
```

Expect `"status":"ok"` (and `"database":"up"`) from `/health`.

---

## Troubleshooting

| Symptom | Likely fix |
|---------|------------|
| Build fails on `pip install` / `pydantic-core` / `maturin` / read-only cargo | Pin **Python 3.12.8** (`PYTHON_VERSION` + `runtime.txt`). Clear build cache and redeploy. Do not use 3.14. |
| Build fails on `pip install` (other) | Confirm **Root Directory** is `backend` |
| App crashes on boot | Check `MONGODB_URI` / DNS / Atlas IP allowlist |
| CORS errors in admin | Add exact frontend origin to `CORS_ORIGINS` |
| OTP emails fail | Set `RESEND_API_KEY`; verify sender domain in Resend |
| Mobile cannot reach API | Use `https://…` Render URL in `EXPO_PUBLIC_API_URL` and rebuild |
| 502 / sleep delay | Free instance cold start—retry after wake |
