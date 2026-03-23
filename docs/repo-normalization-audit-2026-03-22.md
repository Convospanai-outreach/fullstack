# Repo Normalization Audit (2026-03-22)

## Scope

Objective: normalize repository ownership so `apps/web` is the canonical production frontend and `apps/api` + `apps/edge-fastapi` are independent service roots.

## Root Repository Baseline

- Root path: `D:\Convo\fullstack`
- Root git branch: `main`
- Root git HEAD: `1cf4683e63ea6807a46b5972e48d9c16dd3522f3`
- Root working tree was already dirty before migration started:
  - modified: `.dockerignore`
  - modified: `.vscode/settings.json`
  - untracked: `apps/`
  - untracked: `build-logs/`
  - untracked: `tmp/tsx-tewar/`

## Nested Git Repositories (Before Removal)

Found nested `.git` directories in:

- `apps/web/.git`
- `apps/api/.git`
- `apps/edge-fastapi/.git`

Nested repo metadata:

- `apps/web`: unborn `HEAD`, no commits, no remotes configured.
- `apps/api`: unborn `HEAD`, no commits, no remotes configured.
- `apps/edge-fastapi`: unborn `HEAD`, no commits, no remotes configured.

Conclusion: removing nested `.git` will not drop commit history because these nested repos do not contain commit objects referenced by `HEAD`.

## Root vs apps/web Frontend Audit

Comparison checks:

- `next.config.mjs`: identical hash.
- `package-lock.json`: identical hash.
- `prisma/schema.prisma`: identical hash.
- `.env.example`: identical hash.
- `package.json`: different hash.

Directory-level check:

- root `src` file count: 609
- `apps/web/src` file count: 755
- symmetric file-set delta count: 174

Conclusion:

- `apps/web` is a superset / evolved frontend target.
- Root still contains a deployable frontend structure and causes build-root ambiguity.
- Canonical production frontend is set to `apps/web`.

## Required Normalization Actions

1. Remove nested `.git` directories under `apps/*`.
2. Retire root frontend runtime/config path to prevent accidental host auto-detection from repo root.
3. Convert root into orchestration/workspace role only.
4. Align GitHub workflows to `apps/web`, `apps/api`, `apps/edge-fastapi`.
5. Verify build/health from app-specific roots.
