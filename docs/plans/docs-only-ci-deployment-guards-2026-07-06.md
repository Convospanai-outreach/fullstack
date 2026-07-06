# Docs-only CI and Deployment Guards

## Problem Observed

Docs-only branches using the `docs/` prefix have been triggering heavyweight automation that does not validate runtime behavior changes and does consume unnecessary compute.

Observed unnecessary checks for docs-only work included:

- `CI / API Strict Typecheck`
- `CI / Web Build`
- `CI / Docker Build Smoke`
- `Production Readiness Gate`
- `Vercel Parity Build`
- `Phi-3 Verification`
- Vercel preview deployments

Railway behavior is already better scoped by watched paths and has reported `No deployment needed - watched paths not modified`, so Railway does not appear to need a config change from this PR.

## Desired Behavior For Docs-only PRs

For change sets limited to docs-only files:

- required GitHub workflows should still conclude successfully
- heavyweight jobs should skip at the job level
- no required check should remain pending because of a top-level workflow skip
- Vercel should not create preview deployments for `docs/*` branches
- Railway should remain unchanged unless future evidence shows docs-only branches still deploy there

Docs-only means all changed files are limited to:

- `docs/**`
- `README.md`
- any `*.md` file
- `.github/pull_request_template.md`
- `.github/ISSUE_TEMPLATE/**`

## GitHub Actions Strategy

Strategy selected in this PR:

1. Add a lightweight docs-only detection job to required workflows.
2. Classify PR or push changes by inspecting the changed file list.
3. Add a lightweight `Docs-only Validation` no-op job that succeeds for docs-only change sets.
4. Gate heavyweight jobs with job-level `if` conditions instead of top-level `paths-ignore`.

Why this pattern:

- required checks continue to resolve cleanly
- skipped heavy jobs do not consume the expensive services, Docker builds, or install/build/test paths
- branch protection is less likely to be blocked by a workflow that never started

Workflows changed in this PR:

- `.github/workflows/ci.yml`
- `.github/workflows/production-gate.yml`
- `.github/workflows/vercel-parity-build.yml`
- `.github/workflows/verify.yml`

Heavy jobs intentionally skipped for docs-only changes:

- API strict typecheck
- web build and full CI web validation path
- Docker build smoke
- production readiness audit path
- Vercel parity build
- Phi-3 verification

## Vercel Strategy

This PR adds `vercel.json` with branch deployment disablement for docs branches:

- `docs/*`
- `docs/**`

Goal:

- docs-only branches remain PR-reviewable without consuming preview deployment compute

## Railway And Supabase Notes

Railway:

- No `railway.json` or `railway.toml` is present in the repo.
- No Railway config change is made in this PR.
- Existing evidence suggests Railway watched-path behavior is already preventing unnecessary deploys for docs-only changes.

Supabase:

- No Supabase config or DB behavior is changed in this PR.
- This PR is purely CI/deployment cost-control.

## Branch Naming Convention

Use `docs/*` for branches that are intentionally docs-only and should not produce preview deployments.

Examples:

- `docs/read-only-db-schema-drift-proof-2026-07-06`
- `docs/db-migration-remediation-plan-2026-07-06`

## Warning About [skip ci]

Do not rely on `[skip ci]` blindly for required-check repositories.

Reason:

- top-level workflow skipping can leave required checks in a pending or missing state
- branch protection may then block merge even though the change is harmless

Preferred pattern:

- start the workflow
- detect docs-only changes
- run a cheap success/no-op path
- skip the expensive jobs with explicit job-level conditions

## Remaining Limitations

- No repo-managed CodeQL workflow exists under `.github/workflows/` in the current tree, so this PR cannot directly add docs-only guards to CodeQL from repository code alone.
- `docker-ghcr.yml` and `phi3-runtime-verify.yml` were left unchanged because they are already path-scoped and do not appear to be the source of docs-only branch waste.
- This PR does not change branch protection settings, repository-level GitHub Advanced Security settings, or external platform rules.
- This PR does not claim production readiness and does not change runtime validation quality for non-docs branches.
