# Lead.embedding Canonical Type Decision

Agent: prisma-drift-agent  
Phase: 4 — Prisma drift resolution  
Branch: `codex/db-linkage-swarm-orchestration` @ `253096d`  
Last updated: 2026-06-18  
Status: **OPTION B ACCEPTED — CTO-approved controlled-beta decision. Schema edits applied. No migration generated.**

---

## Current state (evidence from Phase 4 drift matrix)

| Source | Prisma definition | Live DB column type | Notes |
| --- | --- | --- | --- |
| `packages/db/prisma/schema.prisma` | `embedding Unsupported("vector(1536)")?` | — | Inherits from `apps/web`; not applied to live DB |
| `apps/web/prisma/schema.prisma` | `embedding Unsupported("vector(1536)")?` | — | Requires `postgresqlExtensions` preview feature + `vector` extension declared in datasource |
| `apps/api/prisma/schema.prisma` | `embedding String?` | — | Comment in file: *"Temporarily String to match DB state and unblock push"* |
| Live Supabase (`izqcycslipmbgdwgajvu`) | — | `text` (nullable) | Confirmed by prior read-only inspection; `vector` extension **is** installed on the project |

**Key facts:**
- The `vector` extension is installed on the live Supabase project.
- The live column is currently `text`, not `vector(1536)`.
- `apps/api` intentionally downgraded to `String?` to match live state and unblock `prisma migrate deploy`.
- `apps/web` uses `Unsupported("vector(1536)")` which does not map to the current live column type.
- Neither web nor API schema currently matches the other for this field.
- No vector similarity search feature is currently in production use or gating launch.

---

## Option A — `Unsupported("vector(1536)")` canonical now

### What this means
- Set `packages/db`, `apps/web`, **and** `apps/api` all to `Unsupported("vector(1536)")`.
- Generate and apply a migration that runs `ALTER COLUMN "embedding" TYPE vector(1536)` on live Supabase.
- Web and API Prisma clients will not be able to use this field directly (it is `Unsupported`); raw SQL is required for vector operations.

### Pros
- Canonical schema matches the intended long-term data type.
- Enables vector similarity search without a future migration.
- Consistent with the `apps/web` current schema intent.

### Cons
- **Requires a live DB migration immediately** — `ALTER COLUMN` on the `Lead` table is potentially slow and lock-inducing on a large table.
- `Unsupported` means Prisma generates no typed accessor; all embedding reads/writes must be raw SQL in both web and API.
- Adds migration risk during a controlled beta stabilization phase.
- The `vector` extension being installed does not mean the migration is safe — `Lead` could have existing rows with non-vector text data that would fail the `ALTER COLUMN` cast.
- Both apps need testing of the raw SQL embedding path before this is safe.

### Risk level: **HIGH** for controlled beta

---

## Option B — `String?` canonical now (match live state)

### What this means
- Set `packages/db` and `apps/web` to `String?` (same as `apps/api`).
- No migration needed for this column — live DB already has `text` nullable.
- All three schemas converge immediately.
- Vector search is deferred to a future, separately planned migration.

### Pros
- **Zero migration risk** for this column during beta.
- All three schemas immediately converge — `npm run db:schema:compare` will no longer flag this field.
- Prisma generates a normal typed `String?` accessor; embedding reads/writes work without raw SQL.
- Matches live DB exactly.

### Cons
- `apps/web` schema changes away from its current `Unsupported("vector(1536)")` definition — requires updating `apps/web/prisma/schema.prisma`.
- Loses the schema-level signal that this field is intended to be a vector.
- A future vector migration must be planned separately and is a breaking change on the column.
- If any code in `apps/web` already issues raw `<->` vector similarity operators against this column, it will silently work at the DB level but the schema no longer documents the intent.

### Risk level: **LOW** for controlled beta — but requires schema edit to `apps/web`

---

## Option C — `String?` short-term in `packages/db` and `apps/api`; `apps/web` unchanged; separate future vector migration tracked

### What this means
- Update `packages/db/prisma/schema.prisma` field to `String?` to match live and API.
- Leave `apps/web/prisma/schema.prisma` unchanged (it retains `Unsupported("vector(1536)")`).
- `apps/api` already at `String?` — no change needed.
- Document the divergence explicitly: `packages/db` is the **deployment-safe** canonical source; `apps/web` retains the **intent** schema for reference.
- Create a tracked future task: *Phase N — Vector column upgrade migration*.
- `npm run db:schema:compare` will still flag `packages/db` vs `apps/web` on this field only.

### Pros
- **Zero migration risk** for this column during beta.
- `packages/db` and `apps/api` match live DB — no column migration needed.
- `apps/web` retains the original intent, preventing the signal from being lost entirely.
- The compare script continues to flag the divergence, keeping it visible.
- Lowest risk path to a stable beta.

### Cons
- `packages/db` and `apps/web` diverge on this field — the compare script will exit non-zero, which is expected but must be documented as an allowed exception.
- Does not resolve the field-level drift between `packages/db` and `apps/web`; this is a deliberate deferral, not a fix.
- Requires updating `packages/db` schema (from `Unsupported("vector(1536)")` to `String?`) — a schema edit, but **not** a migration or DB change.

### Risk level: **VERY LOW** for controlled beta

---

## Comparison table

| Criterion | Option A | Option B | Option C |
| --- | --- | --- | --- |
| Migration required on live DB | **Yes** (ALTER COLUMN) | No | No |
| Migration risk to Lead table | **High** | None | None |
| Schema convergence (all three) | Yes | Yes | Partial (`packages/db` + API match; web diverges) |
| Vector search enabled immediately | Yes | No | No |
| Code change to `apps/web` schema | No | **Yes** | No |
| Code change to `packages/db` schema | No | Yes | **Yes** (String? only) |
| Compare script clean | Yes | Yes | **No** (web still differs) |
| Beta blocking risk | **High** | Low | Very low |
| Long-term intent preserved | Yes | **No** | Yes (in web schema) |

---

## Accepted decision: **Option B — `String?` canonical now**

**Decision date:** 2026-06-18  
**Approved by:** CTO (controlled-beta decision)  
**Supersedes:** Option C recommendation from prior draft  

### Rationale accepted

- Immediate schema convergence across all three sources (`packages/db`, `apps/web`, `apps/api`) with no migration.
- Matches live Supabase `text` column exactly — zero DB change needed for this field.
- Removes `Unsupported("vector(1536)")` from both `packages/db` and `apps/web`, eliminating Prisma validation friction.
- Vector search is not a controlled-beta requirement; upgrade is tracked as a separate future migration phase.

### Schema edits applied (2026-06-18)

| File | Before | After |
| --- | --- | --- |
| `packages/db/prisma/schema.prisma` line 38 | `Unsupported("vector(1536)")?` | `String?` |
| `apps/web/prisma/schema.prisma` line 38 | `Unsupported("vector(1536)")?` | `String?` |
| `apps/api/prisma/schema.prisma` line 38 | `String?` (already correct) | No change |

### No migration generated

No `prisma migrate dev` or `prisma migrate diff` was run. The live DB column is already `text` (nullable). No ALTER COLUMN is required for this change.

### Future vector upgrade (tracked separately)

When vector search is required:
1. Plan a dedicated migration phase.
2. Run `prisma migrate diff` against a non-production clone.
3. Review generated `ALTER COLUMN "embedding" TYPE vector(1536)` SQL for safety on production data.
4. Apply with explicit DBA approval, VACUUM, index rebuild plan, and rollback procedure.

---

## Option C — superseded

Option C (String short-term in `packages/db` only, web unchanged) is **superseded** by Option B. The full convergence approach was chosen to eliminate all schema drift on this field for the beta.

---

## Recommendation for controlled beta: ~~Option C~~ **Option B (accepted)**


**Rationale:**

1. **No migration risk.** The `Lead` table is production data. An `ALTER COLUMN` to change `text` → `vector(1536)` during a beta stabilization phase is an unnecessary risk. There is no vector similarity search feature currently in production use.

2. **Lowest schema churn.** `apps/web` keeps its intent signal. `packages/db` is updated to match live and API. Only one schema file changes, and it is not a migration.

3. **Compare script continues to flag it.** The drift between `packages/db` (`String?`) and `apps/web` (`Unsupported("vector(1536)")`) is documented and visible. It will not silently disappear.

4. **Clean path forward.** When vector search is ready to ship, a dedicated, reviewed, preflight-tested vector migration can be planned as its own phase with proper expand-contract safety.

5. **API convergence.** `packages/db` and `apps/api` converge immediately with no DB change.

**What Option C requires:**
- Edit `packages/db/prisma/schema.prisma`: change `embedding Unsupported("vector(1536)")?` → `embedding String?`
- Add a note in `packages/db/prisma/schema.prisma` explaining the divergence from `apps/web`
- Document the vector upgrade as a future tracked task
- Update `npm run db:schema:compare` expected output documentation to note the allowed exception

> **This edit to `packages/db` is not part of this decision document.** It must be approved by the orchestrator and executed in a separate Phase 4 schema-sync step.

---

## Blocked-on decision

| Decision | Required from | Status |
| --- | --- | --- |
| Accept Option C for controlled beta | orchestrator | **NEEDS_DECISION** |
| Plan vector upgrade migration phase | migration-safety-agent | QUEUED |

---

## References

- `docs/audits/prisma-schema-drift-matrix.md` — Phase 4 evidence
- `docs/audits/schema-compare-output.md` — compare script output
- `apps/api/prisma/schema.prisma` line 38: `embedding String? // Temporarily String to match DB state and unblock push`
- `apps/web/prisma/schema.prisma` line 38: `embedding Unsupported("vector(1536)")? // Vector embedding for similarity search`
