# Migration Manifest Format

Last updated: 2026-06-18

Status: Format added; not enforced.

Schema file: `scripts/db/migration-manifest.schema.json`

## Purpose

The migration manifest is an advisory safety artifact for future migration PRs. It records the expected migration names, latest migration, schema fingerprint, canonical schema path, and safety posture before any production migration is considered.

This pass does not enforce the manifest in CI and does not run it against production.

## Required Intent

Every production-targeted manifest should make these facts reviewable:

- canonical schema path, expected to move toward `packages/db/prisma/schema.prisma`
- ordered expected Prisma migration names
- latest expected migration
- expected schema fingerprint
- destructive statement posture
- manual approval requirement
- backup/audit requirement
- EdgeNode orphan preflight expectation when EdgeNode constraints are involved

## Example

```json
{
  "manifestVersion": 1,
  "canonicalSchemaPath": "packages/db/prisma/schema.prisma",
  "environment": "production",
  "expectedMigrations": [
    {
      "name": "20260603120000_user_invitations",
      "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "destructiveReviewed": false,
      "notes": "Example only; not an approved manifest"
    }
  ],
  "expectedLatestMigration": "20260603120000_user_invitations",
  "expectedSchemaFingerprint": "c277e899b339aeb93d8dfaef77426b78",
  "safety": {
    "productionDbPushAllowed": false,
    "destructiveStatementsAllowed": false,
    "requiresManualApproval": true,
    "requiresBackupOrAudit": true,
    "edgeNodeOrphanPreflight": {
      "required": true,
      "expectedOrphanCount": 0
    }
  }
}
```

## Future Enforcement

Later CI can validate that:

1. Manifest JSON matches `scripts/db/migration-manifest.schema.json`.
2. Migration files named in the manifest exist and match recorded hashes.
3. The read-only verifier receives expected migration names from the manifest.
4. Production mode refuses to run without expected count, latest migration, schema fingerprint, and migration names.

Enforcement is intentionally deferred until the canonical `packages/db` plan is approved.
