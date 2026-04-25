# Agent Execution Rules

## Docker
- Do not run local Docker builds (`docker build`, `docker buildx`, `docker compose`, `docker-compose`).
- Do not run `npm run docker:*`.
- Do not start local containers or pull Docker images for validation.
- GitHub Actions is the source of truth for Docker validation.

## Windows npm temp/cache
- Before any local npm command on Windows, set repo-local temp/cache paths:
  - `.tmp-npm/`
  - `.npm-cache/`
- Use:
  - `$env:TEMP = "$PWD\\.tmp-npm"`
  - `$env:TMP = "$PWD\\.tmp-npm"`
  - `$env:npm_config_tmp = "$PWD\\.tmp-npm"`
  - `$env:npm_config_cache = "$PWD\\.npm-cache"`

## Install strategy
- Do not repeat full workspace reinstalls.
- Prefer lockfile-only updates over full installs.
- Prefer:
  - `npm install --package-lock-only --workspaces --include-workspace-root --legacy-peer-deps --no-audit --no-fund`
- If only API metadata changed, prefer:
  - `npm install --package-lock-only --workspace apps/api --include-workspace-root --legacy-peer-deps --no-audit --no-fund`
- Avoid deleting `node_modules` and `package-lock.json` unless explicitly required and justified.

## Prisma in CI
- Never run `prisma db push` in build-only CI jobs.
- Never use `--accept-data-loss` in normal CI.
- Build-only CI may run `prisma generate` with a safe dummy `DATABASE_URL`.
