# Deployment Hardening & Continuous Integration

## Pre-Push Verification

Before pushing any code (especially AI-generated code) to this repository, run the following verification locally:

```bash
npm run verify:before-push
```

This verification does two important things:
1. **Blocks Unsafe `@prisma/client` Imports:** Prevents accidentally pulling Node.js-only backend dependencies into the Next.js `apps/web` client components.
2. **Executes Vercel Parity Build:** Runs the exact same `apps/web` production build that Vercel uses during deployment.

## Why this exists
GitHub Web Build previously passed while Vercel failed due to Prisma exports missing during Next.js typecheck. This creates a painful cycle of waiting for deployments only to hit easily preventable errors. The addition of the GitHub "Vercel Parity Build" action prevents PRs from merging if they break the Vercel app structure.

## Cardinal Rule for Frontend
**Do not import Prisma model/enum exports directly into `apps/web` components or shared frontend files!** 

Instead, always use frontend-safe DTOs/types defined locally (e.g. `apps/web/src/types/*.ts`).

## GitHub Branch Protection

To enforce this deployment hardening, the repository's main branch should configure specifically required status checks in its branch protection rules.

**Recommended Required Checks:**
- Vercel Parity Build
- CI / API Strict Typecheck
- CI / Docker Build Smoke
- CI / Web Build
- Register Docker Images to GHCR
- Phi-3 Verification / Merge Gate
- Phi-3 Verification / Verify Phi-3 Safety Enforcement

**Do NOT Require:**
- Phi-3 Runtime Evaluation
- llama.cpp runtime verification
- model download verification
