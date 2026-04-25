# Deployment Runbook

This runbook assumes the repository root is `D:\Convo\fullstack` and app roots are:

- `apps/web` (Next.js frontend)
- `apps/api` (Fastify API)
- `apps/edge-fastapi` (FastAPI edge service)

## 1) Preflight Checks

Run from repository root:

```powershell
Test-Path .\apps\web\package-lock.json
Test-Path .\apps\web\prisma\schema.prisma
Test-Path .\apps\api\package-lock.json
Test-Path .\apps\edge-fastapi\Dockerfile
Test-Path .\next.config.mjs
```

Expected:

- First four checks are `True`.
- Root `next.config.mjs` is `False` (root is orchestration-only).

## 2) Web Deployment (Vercel)

Connect the exact production repo, then configure project settings:

- Root directory: `apps/web`
- Install command: `npm ci`
- Build command: `npm run build`
- Output directory: default (Next.js)

Environment variables must be created from:

- `apps/web/.env.example`

Critical values:

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `NEXT_PUBLIC_API_URL` (recommended: `https://app.<domain>/api/proxy`)
- `API_INTERNAL_ORIGIN` (recommended: `https://api.<domain>`)
- `WORKSPACE_COOKIE_SECRET`

Build log validation:

- Build runs from `apps/web`.
- Prisma line must show `prisma/schema.prisma` from app root.
- Build must not reference root-level `next.config.mjs` or root app scripts.
- Proxy route exists at `apps/web/src/app/api/proxy/[...path]/route.ts`.

## 2a) Web Docker Build (GHCR or Local)

The web image must be built from the repository root so Docker can use the workspace root `package-lock.json`.

From repository root:

```bash
docker build -t convospan-web:latest -f apps/web/Dockerfile .
```

Or use the convenience script:

```bash
npm run docker:web
```

## 3) API Deployment (Docker on DigitalOcean)

On droplet:

```bash
git clone https://github.com/Convospanai-outreach/fullstack.git /opt/convospan/fullstack
cd /opt/convospan/fullstack
docker build -t convospan-api:latest -f apps/api/Dockerfile apps/api
```

Create env file from app source:

```bash
cp apps/api/.env.example /opt/convospan/api.env
```

Run container:

```bash
docker rm -f convospan-api 2>/dev/null || true
docker run -d \
  --name convospan-api \
  --restart unless-stopped \
  --env-file /opt/convospan/api.env \
  -p 3001:3001 \
  convospan-api:latest
```

Health checks:

```bash
curl -i http://127.0.0.1:3001/health
curl -i http://127.0.0.1:3001/v1/system/health
```

Expected behavior:

- `/health` returns `healthy` or `degraded` with component checks (`database`, `edge`).
- `/v1/system/health` may return `503` for environment-sensitive checks and should not be used as container liveness.

## 4) Edge Deployment (Docker on DigitalOcean, Optional)

On droplet:

```bash
cd /opt/convospan/fullstack
docker build -t convospan-edge-fastapi:latest -f apps/edge-fastapi/Dockerfile apps/edge-fastapi
```

Create env file from app source:

```bash
cp apps/edge-fastapi/.env.example /opt/convospan/edge.env
```

Set required values in `/opt/convospan/edge.env`:

- `DATABASE_URL`
- `EDGE_MODE` (`disabled` or `enabled`)
- `HARDWARE_SIGNATURE`
- `OFFLINE_MODEL_PATH` (when `EDGE_MODE=enabled`)

Run container:

```bash
docker rm -f convospan-edge-fastapi 2>/dev/null || true
docker run -d \
  --name convospan-edge-fastapi \
  --restart unless-stopped \
  --env-file /opt/convospan/edge.env \
  -p 8000:8000 \
  convospan-edge-fastapi:latest
```

Health checks:

```bash
curl -i http://127.0.0.1:8000/health
curl -i http://127.0.0.1:8000/version
```

## 5) CI/CD Expectations

These workflows now target app roots:

- `.github/workflows/ci.yml`
- `.github/workflows/playwright.yml`
- `.github/workflows/production-gate.yml`
- `.github/workflows/docker-ghcr.yml`

Validation rule:

- No workflow should run `npm ci` or `npm run build` from repo root for the web app.
- The exception is the web Docker build context, which intentionally uses repo root so workspace dependency resolution matches local installs and CI.
