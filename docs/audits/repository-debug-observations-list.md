# Repository Debug Observations List

Compile of technical observations, root causes, and remediation details for the CraftMyFunnel production-readiness workflow.

---

## 1. GitHub Actions Docker Layer Caching Sticky Issues
> [!WARNING]
> Buildkit layer caching on `main` branch can remain sticky even when `package.json` and `package-lock.json` are modified.

- **Incident**: The workflow `Register Docker Images to GHCR` on `main` branch continued to fail with a vulnerability finding for `picomatch@4.0.3` (CVE-2026-33671) even after the overrides were merged to resolve it to `4.0.4`.
- **Root Cause**: The `deps` stage in `apps/web/Dockerfile` (#11) was retrieved from `CACHED` layers on the default branch because the cache key matched.
- **Remediation**: Added a cache-busting comment directly into `apps/web/Dockerfile` in the `deps` stage to force Buildx to rebuild the layer and run a clean `npm ci`.
- **Reference PR**: [PR #60 (chore: bust trivy web scan cache)](https://github.com/Convospanai-outreach/fullstack/pull/60)

---

## 2. Prisma Client Constructor Validation and Schema constraints
> [!IMPORTANT]
> The database schema does not specify `url = env("DATABASE_URL")` under the `datasource db` block.

- **Incident**: Executing local readiness scripts (`readiness:check-db-shape` / `readiness:check-migration-status`) threw `PrismaClientConstructorValidationError: Unknown property datasources/datasourceUrl provided to PrismaClient constructor`.
- **Root Cause**: Since the database schema has no `url` property defined, Prisma's generated runtime validator rejects constructor overrides for `datasources` and `datasourceUrl`.
- **Remediation**: Updated both [check-db-shape.ts](file:///d:/Convo/fullstack/scripts/readiness/check-db-shape.ts) and [check-migration-status.ts](file:///d:/Convo/fullstack/scripts/readiness/check-migration-status.ts) to import the canonical `prisma` client wrapper from [db.ts](file:///d:/Convo/fullstack/apps/web/src/lib/db.ts) instead of initializing `new PrismaClient()` directly. This helper leverages `@prisma/adapter-pg` driver pool to bind the URL at runtime dynamically without schema validations.

---

## 3. PR #6 Gmail Control Blocking Status
> [!NOTE]
> PR #6 is blocked pending schema drift proof.

- **Status**: Checked status of PR #6. No actions taken or changes made to Gmail workspace/mail control flows as they are explicitly out of scope for the current stage.

---

## 4. Local Test Environment Readiness
> [!TIP]
> Executing verification scripts locally requires starting the dockerized DB and Redis services using `npm run beta:start`.

- **Observation**: Running readiness audits in sandbox environments without docker compose installed throws `DatabaseNotReachable` errors since the PostgreSQL server on port `5433` is not active. Full functional verification must be triggered via GitHub Actions or staging environments.
