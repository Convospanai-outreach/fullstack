# Schema Compare Output

Captured: 2026-06-18 (post Phase 4 API Auth Sync convergence)  
Command: `node scripts/db/compare-prisma-schemas.mjs`  
Exit code: 0 (MATCH — all schemas aligned)  
Branch: `codex/db-linkage-swarm-orchestration`  

## Raw output

```
Prisma schema comparison
- packages/db/prisma/schema.prisma: 2362 lines, sha256=3d46e8b3432ee226c287bdca5b4ab544dea88842c27f9c159e27f387bb905827
- apps/web/prisma/schema.prisma: 2362 lines, sha256=3d46e8b3432ee226c287bdca5b4ab544dea88842c27f9c159e27f387bb905827
- apps/api/prisma/schema.prisma: 2362 lines, sha256=3d46e8b3432ee226c287bdca5b4ab544dea88842c27f9c159e27f387bb905827

packages/db/prisma/schema.prisma <-> apps/web/prisma/schema.prisma
  status: MATCH
  left sha256:  3d46e8b3432ee226c287bdca5b4ab544dea88842c27f9c159e27f387bb905827
  right sha256: 3d46e8b3432ee226c287bdca5b4ab544dea88842c27f9c159e27f387bb905827

packages/db/prisma/schema.prisma <-> apps/api/prisma/schema.prisma
  status: MATCH
  left sha256:  3d46e8b3432ee226c287bdca5b4ab544dea88842c27f9c159e27f387bb905827
  right sha256: 3d46e8b3432ee226c287bdca5b4ab544dea88842c27f9c159e27f387bb905827

apps/web/prisma/schema.prisma <-> apps/api/prisma/schema.prisma
  status: MATCH
  left sha256:  3d46e8b3432ee226c287bdca5b4ab544dea88842c27f9c159e27f387bb905827
  right sha256: 3d46e8b3432ee226c287bdca5b4ab544dea88842c27f9c159e27f387bb905827

Summary
- shared vs web: MATCH
- shared vs api: MATCH
- web vs api: MATCH
```

## Interpretation

| Pair | Result | Cause |
| --- | --- | --- |
| `packages/db` ↔ `apps/web` | **MATCH** | ✅ Embedding convergence confirmed. Both identical. |
| `packages/db` ↔ `apps/api` | **MATCH** | ✅ Auth/invite convergence confirmed. Both identical. |
| `apps/web` ↔ `apps/api` | **MATCH** | ✅ Both identical. |

## What changed since last run

1. **Auth/Invite Model Sync**: Added `UserInvitation`, `InviteRequest`, `InvitationStatus`, `InviteRequestStatus` to `apps/api/prisma/schema.prisma`.
2. **User & Team Relations**: Added the `userInvitations` relation on `Team`, and `sentInvitations`/`approvedInviteRequests` relations on `User`.
3. **UserRole & Enum parity**: Synced `UserRole` enum values and alignment on other enum variants (`revoked` vs `cancelled` etc.).
4. **Header Sync**: Synced the generator options and datasource block to remove `previewFeatures = ["postgresqlExtensions"]` and `extensions = [vector]` since all vector fields are represented as `String?`.

All three files are now 100% identical.

## Safety note

This script is read-only. It does not connect to any database and does not touch migrations.
