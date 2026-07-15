# Deploy FieldOps Nexus Admin on Vercel

This guide covers building the Vite/React admin panel and deploying it to [Vercel](https://vercel.com).

The API stays on Render: **`https://fieldops-nexus.onrender.com`**.

---

## Local production build

From the `admin/` directory:

```bash
cd admin
npm install
npm run build
```

Output: `admin/dist/`

Preview locally:

```bash
npm run preview
```

Opens at [http://localhost:4173](http://localhost:4173).

---

## Environment variables

| Mode | File | Value |
|------|------|--------|
| **Production (active)** | `.env` / `.env.production` | `VITE_API_URL=https://fieldops-nexus.onrender.com` |
| **Development (commented)** | same files | `# VITE_API_URL=http://localhost:8000` |

Vite bakes `VITE_*` values in at **build time**. Changing them on Vercel requires a **redeploy**.

---

## Deploy with the Vercel dashboard

1. Push the repo to GitHub/GitLab/Bitbucket.
2. Vercel → **Add New…** → **Project** → import the repo.
3. Configure:

| Setting | Value |
|--------|--------|
| **Framework Preset** | Vite |
| **Root Directory** | `admin` |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |
| **Install Command** | `npm install` |

4. **Environment Variables** (Production):

| Name | Value |
|------|--------|
| `VITE_API_URL` | `https://fieldops-nexus.onrender.com` |

Optional Preview/Development:

| Name | Value |
|------|--------|
| `VITE_API_URL` | `http://localhost:8000` (only useful if the preview can reach your machine — usually keep production URL for Preview too) |

5. Deploy.

Your site URL will look like:

```text
https://fieldops-nexus-admin.vercel.app
```

(or your custom domain).

---

## Deploy with Vercel CLI

```bash
cd admin
npm i -g vercel          # once
vercel login
vercel                   # preview deploy
vercel --prod            # production
```

When prompted:

- Set root / link to the `admin` project
- Ensure `VITE_API_URL=https://fieldops-nexus.onrender.com` is set (CLI or dashboard)

`admin/vercel.json` rewrites all routes to `index.html` so React Router deep links (`/users/…`, `/projects/…`) work on refresh.

---

## CORS on Render (required)

After you know the Vercel URL, add it to the API’s `CORS_ORIGINS` on Render:

```text
https://YOUR-ADMIN.vercel.app,http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173
```

Example:

```text
https://fieldops-nexus-admin.vercel.app,http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173
```

Redeploy or restart the Render service after changing env vars.

Without this, the browser will block admin → API requests.

---

## SPA routing note

This admin uses `BrowserRouter`. `vercel.json` already contains:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

Do not remove that rewrite or deep links will 404 on refresh.

---

## Verify after deploy

1. Open `https://YOUR-ADMIN.vercel.app`
2. Sign in with an admin account
3. Confirm Settings (or network tab) calls `https://fieldops-nexus.onrender.com/api/v1/...`
4. If login fails with a CORS/network error, update `CORS_ORIGINS` on Render and retry

Cold starts: the Render free API may take ~30–60s to wake on first request.

---

## Troubleshooting

| Symptom | Likely fix |
|---------|------------|
| Blank page / 404 on refresh | Confirm Root Directory is `admin` and `vercel.json` rewrites exist |
| `Failed to fetch` / CORS error | Add the exact Vercel origin to Render `CORS_ORIGINS` |
| Still hitting localhost | Set `VITE_API_URL` on Vercel and **redeploy** (env is build-time) |
| Build fails on TypeScript | Run `npm run build` locally; fix errors, then push |
| Map tiles fail | Network / adblock; optional `VITE_MAP_STYLE_URL` override |

---

## Quick reference

```bash
# Build
cd admin && npm run build

# Vercel production
vercel --prod

# API (already deployed)
https://fieldops-nexus.onrender.com
```
