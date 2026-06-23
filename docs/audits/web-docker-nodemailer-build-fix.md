# Web Docker Nodemailer Build Fix

Date: 2026-06-23
Agent: npm-lockfile-ci-stability-agent
Repository: `Convospanai-outreach/fullstack`
Latest main inspected: `e14806ca01439219fa3f93214acd07b1d3a9d042`

## Failing Workflow

Workflow: `Register Docker Images to GHCR`
Run ID: `28018282239`
Job: `build-and-push`
Failing step: `Build Web image (no push)`

Exact Docker build command from the workflow log:

```text
docker buildx build --cache-from type=gha --cache-to type=gha,mode=max --file ./apps/web/Dockerfile --tag ghcr.io/convospanai-outreach/fullstack/web:test --load .
```

Exact build error:

```text
Error: Turbopack build failed with 1 errors:
./apps/web/src/lib/email/smtpClient.ts:1:1
Module not found: Can't resolve 'nodemailer'

Import trace:
  App Route:
    ./apps/web/src/lib/email/smtpClient.ts
    ./apps/web/src/app/api/support/contact/route.ts
```

## Investigation

Files inspected:

- `apps/web/Dockerfile`
- `.github/workflows/docker-ghcr.yml`
- `package.json`
- `package-lock.json`
- `apps/web/package.json`
- `apps/web/src/lib/email/smtpClient.ts`

`nodemailer` is correctly declared in `apps/web/package.json`:

```json
"nodemailer": "^9.0.1"
```

The root lockfile places the dependency in the web workspace:

```text
apps/web/node_modules/nodemailer
```

Local install layout confirmed:

```text
root node_modules/nodemailer: absent
apps/web/node_modules/nodemailer: present
```

`npm explain nodemailer --workspace apps/web` confirms:

```text
nodemailer@9.0.1
apps/web/node_modules/nodemailer
  nodemailer@"^9.0.1" from craftmyfunnel-full-scaffold
```

## Root Cause

The Docker `deps` stage runs:

```sh
npm ci --workspace apps/web --include-workspace-root --no-audit --no-fund --legacy-peer-deps
```

That install creates workspace-local dependencies under `/repo/apps/web/node_modules`, including `nodemailer`.

The Docker `builder` stage copied only:

```dockerfile
COPY --from=deps /repo/node_modules ./node_modules
```

It did not copy `/repo/apps/web/node_modules`, so `npx next build` ran from `/repo/apps/web` without the app-local workspace dependency tree that contains `nodemailer`.

## Fix

Changed `apps/web/Dockerfile` so the builder stage also receives the web workspace dependency tree:

```dockerfile
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/web/node_modules ./apps/web/node_modules
COPY . .
```

This is minimal because it does not change app code, dependency versions, package manifests, lockfiles, workflow policy, SMTP behavior, or runtime secrets. It only carries the dependency tree that npm already installed in the previous Docker stage into the stage that runs the Next.js build.

## Validation

Security audit:

```powershell
npm audit --audit-level=high --omit=dev
```

Result: passed with exit code `0`. Remaining findings are low/moderate and remain Stage 13 follow-up work.

npm 10 lockfile sync:

```powershell
npx -p npm@10 npm ci --dry-run --loglevel=error
```

Result: passed with exit code `0`.

Workspace dependency placement:

```powershell
npm ls nodemailer --workspace apps/web
npm explain nodemailer --workspace apps/web
```

Result: passed. `nodemailer@9.0.1` is installed at `apps/web/node_modules/nodemailer`.

Web typecheck:

```powershell
npm run typecheck --workspace apps/web
```

Result: passed.

Web build:

```powershell
npm run build --workspace apps/web
```

Result: passed in 858.0s with dummy DB URLs and CI placeholder auth env.

Docker build:

```powershell
docker build -f apps/web/Dockerfile .
```

Result: not run locally because Docker is not installed in this Windows environment:

```text
docker : The term 'docker' is not recognized as the name of a cmdlet, function, script file, or operable program.
```

GitHub GHCR workflow confirmation:

- Not yet confirmed in this local run.
- `.github/workflows/docker-ghcr.yml` runs on `push` to `main` and `workflow_dispatch`, not ordinary PR branch pushes.
- No local `gh` CLI or GitHub token is available to manually dispatch the workflow from this environment.
- Confirmation must come from a manual `workflow_dispatch` on this branch or the post-merge `main` push.

## Remaining Blockers

- GHCR web Docker image workflow must be rerun and confirmed green.
- Railway statuses still include failing duplicate/stale-looking `illustrious-warmth` services and one pending `airy-balance` full scaffold status. This hotfix does not change Railway env or dashboard service mapping.
- `API_INTERNAL_ORIGIN` remains unproven/not set.
- Live DB migration/schema drift remains unresolved.
- Live DB is still missing Clerk/invite schema required by application code.
- Unsafe `20260604140000_edge_runtime_pairing` migration still requires quarantine/replan before production migration.
- Stage 13 low/moderate dependency alert mapping remains open.
- PR #6 must not merge as-is.

## Safety Notes

No DB schema edits, Prisma schema changes, migrations, Supabase production data changes, Vercel/Railway/Clerk/Redis env or secret changes, PR #6 changes, OAuth scope changes, Chrome extension permission changes, LinkedIn automation changes, UI changes, or `npm audit fix --force` were performed.

This does not mark `PRODUCTION_READY` or `CONTROLLED_BETA_READY`.
