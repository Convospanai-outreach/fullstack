# Codex Master Prompt

Copy this prompt into Codex / Antigravity IDE to execute the agentic swarm.

```text
You are Codex working inside Antigravity IDE on the CraftMyFunnel monorepo.

Your task is not to rush implementation. Your task is to orchestrate an agentic swarm that fixes Vercel, Supabase, Prisma, DB/auth/cache, migration, and CI linkage issues using a strict PLAN -> CHECK -> ACT -> REPLAN loop.

Start by reading these files in order:

1. docs/codex/IMPLEMENTATION_PLAN.md
2. docs/codex/AGENTS.md
3. docs/codex/WORKFLOW_STATE.md
4. docs/codex/VERIFICATION_MATRIX.md

You must use the agents defined in AGENTS.md.

You must update WORKFLOW_STATE.md after every stage.

You must update VERIFICATION_MATRIX.md whenever evidence is gathered.

You must not run destructive production migrations.

You must not use prisma db push against production.

You must not expose secrets.

You must not merge PR #6 as-is.

You must treat Vercel READY as insufficient until DB/schema/auth/cache readiness is proven.

You must treat SELECT 1 as insufficient until migrations, required tables, required columns, app environment marker, and schema fingerprint are verified.

Execution order:

1. Run orchestrator for Stage 0.
2. Run repo-cartographer for Stage 1.
3. Run vercel-linkage-agent for Stage 2.
4. Run supabase-inspector for Stage 3.
5. Run prisma-drift-agent for Stages 4 and 5.
6. Run migration-safety-agent for Stage 6.
7. Run runtime-db-agent for Stage 7.
8. Run env-guard-agent for Stage 8.
9. Run health-smoke-agent for Stage 9.
10. Run auth-tenant-agent for Stage 10.
11. Run redis-cache-agent for Stage 11.
12. Run ci-gate-agent for Stage 12.
13. Run pr-strategy-agent for PR #2 and PR #6 split strategy.
14. Run release-readiness-agent for Stage 13.

For each agent, output and record:

- PLAN
- CHECK
- ACT
- REPLAN
- status
- evidence
- files changed
- blockers
- next agent

Do not continue to the next stage if the current stage is BLOCKED or NEEDS_REPLAN unless the orchestrator explicitly updates the plan.

At the end, produce a final PR-ready summary and ensure docs/audits/production-readiness-final.md exists.
```

## Useful final command to Codex

After pasting the prompt, tell Codex:

```text
Begin Stage 0 as orchestrator. Do not implement code yet. First update WORKFLOW_STATE.md with the current branch and baseline commit, then proceed to Stage 1.
```
