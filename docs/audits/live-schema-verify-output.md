# Live DB Schema Verification Output

Captured: 2026-06-18  
Status: **BLOCKED_EXTERNAL_ACCESS**  
Target Database: Supabase project `izqcycslipmbgdwgajvu` (Fullstack2026)  

---

## 1. Execution Log & Block Reason

Attempts to execute the read-only verification queries from `live-schema-verify-plan.md` against the remote Supabase database were blocked. 

**Root Cause**: The local shell environment and the codebase configuration do not have access to any credentials, connection strings, or tokens for the remote staging/production database.

* Local environment files (`apps/api/.env` and `apps/web/.env`) are strictly configured to point to the local development database instance:
  ```
  DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/craftmyfunnel?schema=public
  ```
* No staging or production connection credentials (e.g., `DATABASE_URL`, `DIRECT_URL`, or `SUPABASE_DIRECT_URL`) are loaded in the current operating system shell.
* No CLI access tokens (Vercel CLI or Supabase CLI) are configured or logged in, preventing remote retrieval of credentials.

---

## 2. Missing Credentials / Required Access

To successfully run this read-only schema verification against the live Supabase instance, the following credentials must be provisioned:

1. **`DATABASE_URL` (Staging/Production)**: A connection string target for the live database (port 5432 or connection pooled port 6543) to read schema tables and types.
2. **`DIRECT_URL` (Staging/Production)**: Direct connection string to bypass connection pooler constraints if querying system tables or runtimes.
3. **Vercel Env Access**: Alternatively, a Vercel project access token to pull the production environment variables using `vercel env pull`.
