# Schema Compare Output

Captured: 2026-06-18 (post Option B embedding convergence)  
Command: `node scripts/db/compare-prisma-schemas.mjs`  
Exit code: 1 (DIFFER — expected; remaining drift is auth/invite gap only)  
Branch: `codex/db-linkage-swarm-orchestration`  

## Raw output

```
Prisma schema comparison
- packages/db/prisma/schema.prisma: 2362 lines, sha256=3d46e8b3432ee226c287bdca5b4ab544dea88842c27f9c159e27f387bb905827
- apps/web/prisma/schema.prisma: 2362 lines, sha256=3d46e8b3432ee226c287bdca5b4ab544dea88842c27f9c159e27f387bb905827
- apps/api/prisma/schema.prisma: 2291 lines, sha256=a971cc7405c2d35046b36f07214785e44d9c2cddc14f4d911f61cf3e7d632bd4

packages/db/prisma/schema.prisma <-> apps/web/prisma/schema.prisma
  status: MATCH
  left sha256:  3d46e8b3432ee226c287bdca5b4ab544dea88842c27f9c159e27f387bb905827
  right sha256: 3d46e8b3432ee226c287bdca5b4ab544dea88842c27f9c159e27f387bb905827

packages/db/prisma/schema.prisma <-> apps/api/prisma/schema.prisma
  status: DIFFER
  left sha256:  3d46e8b3432ee226c287bdca5b4ab544dea88842c27f9c159e27f387bb905827
  right sha256: a971cc7405c2d35046b36f07214785e44d9c2cddc14f4d911f61cf3e7d632bd4
  left semantic sha256:  4724b17d267e9655154b00b41f1a4d61d589f2cddd074a62ad35eb14e442c8e7
  right semantic sha256: 92128eba6e10877d782656f9906a161135a92c2621d92e4041b0a83c4aef0328
  models only in left: InviteRequest, UserInvitation
  models only in right: none
  enums only in left: InvitationStatus, InviteRequestStatus
  enums only in right: none

apps/web/prisma/schema.prisma <-> apps/api/prisma/schema.prisma
  status: DIFFER
  left sha256:  3d46e8b3432ee226c287bdca5b4ab544dea88842c27f9c159e27f387bb905827
  right sha256: a971cc7405c2d35046b36f07214785e44d9c2cddc14f4d911f61cf3e7d632bd4
  left semantic sha256:  4724b17d267e9655154b00b41f1a4d61d589f2cddd074a62ad35eb14e442c8e7
  right semantic sha256: 92128eba6e10877d782656f9906a161135a92c2621d92e4041b0a83c4aef0328
  models only in left: InviteRequest, UserInvitation
  models only in right: none
  enums only in left: InvitationStatus, InviteRequestStatus
  enums only in right: none

Summary
- shared vs web: MATCH
- shared vs api: DIFFER
- web vs api: DIFFER
```

## Interpretation

| Pair | Result | Cause |
| --- | --- | --- |
| `packages/db` ↔ `apps/web` | **MATCH** | ✅ Embedding convergence confirmed. Both identical. |
| `packages/db` ↔ `apps/api` | **DIFFER** | Auth/invite gap only: `UserInvitation`, `InviteRequest`, `InvitationStatus`, `InviteRequestStatus` |
| `apps/web` ↔ `apps/api` | **DIFFER** | Same auth/invite gap |

## What changed since last run

Previous run (commit `b9fd15d`): `Lead.embedding` was `Unsupported("vector(1536)")` in `packages/db` and `apps/web`, causing a type-level semantic gap vs `apps/api` (`String?`).

This run: `Lead.embedding` is now `String?` in **all three schemas**. The embedding TYPE_DRIFT is **resolved**.

## Remaining DIFFER — auth/invite gap

The only remaining schema gap between `packages/db`/`apps/web` and `apps/api` is the auth and onboarding models:

| Missing from `apps/api` | Type |
| --- | --- |
| `UserInvitation` | Model |
| `InviteRequest` | Model |
| `InvitationStatus` | Enum |
| `InviteRequestStatus` | Enum |

This gap is documented in `docs/audits/api-auth-schema-sync-plan.md` and is the **sole remaining Phase 4 action item** before schemas can fully converge.

## Expected state after auth sync

Once `apps/api` schema additions from `api-auth-schema-sync-plan.md` are applied, the expected compare result is:
- `packages/db` ↔ `apps/web`: MATCH
- `packages/db` ↔ `apps/api`: MATCH
- `apps/web` ↔ `apps/api`: MATCH
- Exit code: 0

## Safety note

This script is read-only. It does not connect to any database and does not touch migrations.
