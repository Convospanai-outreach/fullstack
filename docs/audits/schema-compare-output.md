# Schema Compare Output

Captured: 2026-06-18  
Command: `npm run db:schema:compare`  
Exit code: 1 (DIFFER — expected; API drift is known)  
Branch: `codex/db-linkage-swarm-orchestration` @ `7e82c01`

## Raw output

```
> db:schema:compare
> node scripts/db/compare-prisma-schemas.mjs

Prisma schema comparison
- packages/db/prisma/schema.prisma: 2364 lines, sha256=c8f570cbcbf6ae64369e7a884d49ac6ad582856f53407fc988eff992d1660303
- apps/web/prisma/schema.prisma: 2364 lines, sha256=c8f570cbcbf6ae64369e7a884d49ac6ad582856f53407fc988eff992d1660303
- apps/api/prisma/schema.prisma: 2291 lines, sha256=a971cc7405c2d35046b36f07214785e44d9c2cddc14f4d911f61cf3e7d632bd4

packages/db/prisma/schema.prisma <-> apps/web/prisma/schema.prisma
  status: MATCH
  left sha256:  c8f570cbcbf6ae64369e7a884d49ac6ad582856f53407fc988eff992d1660303
  right sha256: c8f570cbcbf6ae64369e7a884d49ac6ad582856f53407fc988eff992d1660303

packages/db/prisma/schema.prisma <-> apps/api/prisma/schema.prisma
  status: DIFFER
  left sha256:  c8f570cbcbf6ae64369e7a884d49ac6ad582856f53407fc988eff992d1660303
  right sha256: a971cc7405c2d35046b36f07214785e44d9c2cddc14f4d911f61cf3e7d632bd4
  left semantic sha256:  90907caf499f820ed535789f79034b36d7aa131ab48c2801f4b261b91df476a3
  right semantic sha256: 92128eba6e10877d782656f9906a161135a92c2621d92e4041b0a83c4aef0328
  models only in left: InviteRequest, UserInvitation
  models only in right: none
  enums only in left: InvitationStatus, InviteRequestStatus
  enums only in right: none

apps/web/prisma/schema.prisma <-> apps/api/prisma/schema.prisma
  status: DIFFER
  left sha256:  c8f570cbcbf6ae64369e7a884d49ac6ad582856f53407fc988eff992d1660303
  right sha256: a971cc7405c2d35046b36f07214785e44d9c2cddc14f4d911f61cf3e7d632bd4
  left semantic sha256:  90907caf499f820ed535789f79034b36d7aa131ab48c2801f4b261b91df476a3
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

| Pair | Result | Reason |
| --- | --- | --- |
| `packages/db` ↔ `apps/web` | **MATCH** | `packages/db` is a direct copy of `apps/web` schema |
| `packages/db` ↔ `apps/api` | **DIFFER** | `apps/api` is missing `UserInvitation`, `InviteRequest`, `InvitationStatus`, `InviteRequestStatus` |
| `apps/web` ↔ `apps/api` | **DIFFER** | Same gap as above |

## What the compare script does NOT catch

The script compares only model and enum block names at a high level, plus semantic content hashes. It does **not** perform a field-level diff. The following known field-level differences require manual inspection and are captured in `docs/audits/prisma-schema-drift-matrix.md`:

- `Lead.embedding`: `Unsupported("vector(1536)")?` in web/packages vs `String?` in API
- `User.clerkUserId`: present in web (mapped to `clerk_user_id`), absent in API
- `User` relations: `sentInvitations`, `approvedInviteRequests` in web; absent in API

## Safety note

This script is read-only. It does not connect to any database and does not touch migrations.
