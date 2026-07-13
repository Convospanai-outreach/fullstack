# ADR: Secure API-key lookup, versioning and legacy transition

## Context

Stage 12A remains blocked by `S12A-HIGH-001`: API keys are stored and looked up as raw reusable secrets. This decision records the architecture for secure lookup, legacy compatibility, and the next atomic implementation PR. It is documentation-only: no storage, authentication, route, UI, schema, migration, provider, or production data change is approved here.

Repository evidence:

| File | Purpose | Current key format | Raw key stored? | Authentication lookup method | Tenant scoped? | Role protected? | Scope aware? | Legacy dependency? | Required future change? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `apps/api/src/lib/apiKeySecurity.ts` | PR #107 format/scope primitives | New `cmf_live_` plus legacy `sk_live_`/`cs_live_` validators | No persistence here | Not used by `validateApiKey()` yet | N/A | N/A | Allowlisted scopes are defined | Yes, legacy validators remain | Integrate creation/auth/listing with these primitives |
| `apps/api/src/lib/apiAuth.ts` | API-key authentication for API routes | Accepts whatever is in `x-api-key` | Yes, via `ApiKey.key` records | `findUnique({ key: apiKey })` | Returns record `teamId` | No admin check; route scopes only | String includes plus `admin` bypass | Yes | Replace raw lookup with deterministic stored representation lookup and dual-read legacy fallback |
| `apps/api/routes/settings/keys/route.ts` | Settings key list/create | Issues `sk_live_` + 24 random bytes | Yes | N/A | Uses current `teamId` | ADMIN via `authorizeRole` | Client-supplied scopes are not routed through allowlist helper | Yes | Issue `cmf_live_`, store digest representation, validate scopes, metadata-only list |
| `apps/api/routes/governance/keys/route.ts` | Governance key list/create | Issues `cs_live_` + 24 random bytes | Yes | N/A | Uses current `teamId` | ADMIN via `checkTeamPermission` | Hard-coded scopes | Yes | Same issuance/storage/listing behavior as settings route |
| `apps/api/routes/settings/keys/[id]/route.ts` | Key delete/revoke endpoint | By key `id` | N/A | N/A | `deleteMany({ id, teamId })` | ADMIN via `checkTeamPermission` | N/A | No | Change to immediate revocation (`isActive=false`) unless hard delete is separately approved |
| `apps/api/routes/v1/**` and `apps/api/routes/webhooks/netjana-intel/route.ts` | API-key protected business routes | Depends on `validateApiKey()` | Indirectly yes | `validateApiKey(req, requiredScope)` | Key-derived `teamId` | Scope only after key auth | Yes | Yes | Covered by atomic auth helper change and route tests |
| `apps/web/src/app/settings/keys/page.tsx` | Settings UI | Displays one-time key from `/settings/keys` | Client receives raw once | N/A | Backend-owned | Backend-owned | Sends a fixed scope set | Yes | Do not change in next atomic PR; preserve one-time display contract |
| `apps/web/src/app/(dashboard)/governance/keys/page.tsx` | Governance UI | Displays/copies `key` returned by `/governance/keys` | Can display masked returned key | N/A | Backend-owned | Backend-owned | Displays scopes | Yes | Do not change in next atomic PR; backend response must become metadata-only |
| `apps/api/prisma/schema.prisma` | Active API schema | `ApiKey.key String @unique` | Yes today | Indexed `key` column | `teamId` relation/index | N/A | `scopes String[]` | Yes | Reuse `key` for versioned stored representation first; defer additive metadata columns unless needed |
| `apps/api/prisma/migrations/20251217192911_add_api_keys_v2/migration.sql` | Existing API-key table migration | Raw `key TEXT NOT NULL` | Yes today | Unique + index on `key` | `teamId` FK/index | N/A | `scopes TEXT[]` | Yes | Do not edit in this PR; document expand-contract path only if later metadata columns are needed |
| `apps/api/src/lib/rateLimit.ts` | General rate-limit identifier helper | Hashes `x-api-key` candidate | Does not persist raw | Candidate-key-derived bucket | User/API-key/IP | N/A | N/A | Yes | Failed API-key auth throttling must not key only by the candidate secret |
| `apps/api/src/lib/governance/audit.ts` | Audit event writer/dispatcher | Metadata supplied by caller | Caller-dependent | N/A | `orgId` supplied | N/A | N/A | N/A | Audit payloads must exclude raw tokens, digests, and secret material |

No newer PR found before this decision already documents this architecture. PR #106 remains open and must not be merged or reused as the implementation path.

## Current State

PR #107 added core primitives for `cmf_live_` tokens with 32 random bytes, legacy format recognition for `sk_live_` and `cs_live_`, display metadata helpers, and server-defined scope allowlists. The primitives are not yet integrated into active creation routes or `validateApiKey()`.

Active API-key storage still stores the presented reusable token in `ApiKey.key`. Active authentication still queries that column by the presented `x-api-key` value. Settings and governance creation routes issue different legacy prefixes. Governance listing masks the raw key from the stored value; settings listing omits the key. Revocation currently deletes settings keys by team-scoped `id`.

## Current-State Checkpoint - 2026-07-13

PR #107 is merged and remains preparatory primitives only. PR #109 is still open and must be corrected before approval because current ADR review findings remain. PR #110 is open, unmerged, and frozen for replan; its current review identified blocking security and compatibility defects, including cross-tenant knowledge access, API-key-only Fastify `/v1` access failure, spoofable failed-auth source headers, throttle bypass paths, unbounded process-local throttle state, pre-throttle Prisma lookup, audit-after-persistence orphaned credentials, governance UI credential-copy risk, default-scope regression, non-idempotent revocation, and body parsing before authentication.

Main has not received the integrated API-key implementation. The active runtime still uses pre-integration API-key behavior. Legacy raw keys have not been inventoried or rotated. Dynamic tenant, role, and API-key abuse proof has not run. Stage 12A remains `STAGE_12A_BLOCKED_HIGH`.

## Threat Model

Assets: API-key raw secrets, stored lookup representations, API-key metadata, tenant/team IDs, scopes, audit logs, rate-limit records, application environment variables, Prisma data, and API-key protected lead/campaign/task/workflow data.

Trust boundaries: browser or third-party client to Render API over HTTPS; API route to Prisma/Neon; API route to Redis or in-memory rate-limit fallback; API route to audit logging/webhook dispatch; Vercel web UI to Render API through configured API origin.

Compromise cases:

| Case | Risk | Required control |
| --- | --- | --- |
| Database read-only compromise | Raw stored keys become live bearer credentials today | New records must store only versioned digest representation and safe metadata |
| Database write compromise | Attacker may insert/activate forged records or widen scopes | Admin routes remain protected; scopes are server-validated; audit and anomaly monitoring required |
| Application runtime/environment compromise | Runtime can authenticate and may observe presented tokens | Redaction, least-privilege logs, and incident rotation runbooks required; SHA-256 design does not claim to survive runtime compromise |
| Logs and telemetry compromise | Raw keys or digests in errors/audits would aid replay or targeting | Never log raw tokens, digests, pepper material, or complete stored representations |
| API-key value leak | Leaked bearer token gives its scoped access until revoked | Immediate revocation, failed-auth throttling, audit, and owner rotation guidance |
| Unauthorized admin action | A non-admin creates/lists/revokes keys | ADMIN role checks must remain on both creation/list/revoke surfaces |
| Brute-force authentication attempts | Online guessing or sprayed candidate keys | 256-bit generated tokens plus requester-context failed-auth throttling |
| Cross-tenant IDOR | Team A lists/revokes/authenticates as Team B | Creation/list/revoke scoped by current `teamId`; authentication returns only key record `teamId`; route tests must cover Team A vs Team B |
| Rollback during deployment | New digests fail if older code expects raw keys | Dual-read legacy compatibility and deploy order keep old records valid; rollback does not rewrite records |

## Security Objectives

1. Newly generated tokens contain at least 256 bits of entropy.
2. Raw tokens are displayed exactly once.
3. Newly issued raw tokens are never persisted.
4. Database compromise alone should not reveal usable new API keys.
5. Lookup remains efficient and deterministic.
6. Raw tokens, digests, and secret material do not appear in logs, errors, audit events, or list responses.
7. Team A cannot access, list, revoke, or authenticate as Team B.
8. Revocation takes effect immediately.
9. Scope validation is server-defined.
10. Legacy raw-key compatibility is explicit, temporary, and measurable.
11. The system supports key versioning and future rotation.
12. Application-secret rotation does not silently invalidate every API key.

## Considered Designs

### SHA-256 Lookup Digest

Store a versioned representation derived from a uniformly random 256-bit token:

`cmf_sha256_v1:<last4>:<sha256(rawToken)>`

This is an indexed deterministic lookup digest for a server-generated random API token. It is not password hashing. With 256 bits of random material, offline guessing after DB read is not practical, while lookup remains a single indexed `findUnique` on the existing unique `key` column. It adds no new production secret lifecycle and is compatible with app-secret rotation. CodeQL password-hashing alerts against this helper should be treated as false positives only when the code path is constrained to generated API tokens and documented with tests.

Limitation: database write compromise can still insert attacker-controlled records, so admin authorization, audit, and write-integrity monitoring remain required.

### HMAC-SHA-256 With Dedicated Pepper

Store:

`cmf_hmac_v1:<last4>:<hmac_sha256(dedicatedPepper, rawToken)>`

This improves DB-read compromise resistance if the pepper remains outside the DB. It requires a dedicated secret owner, storage location, Vercel and Render distribution, local/test handling, rotation windows, overlapping key versions, rollback rules, missing-secret behavior, and monitoring. This repository has general environment-secret docs, but no approved dedicated API-key pepper lifecycle. Reusing Clerk, NextAuth, OAuth, DB, encryption, or provider secrets is rejected.

### Public ID Plus Verifier

Use a token such as:

`cmf_live_<public-id>_<random-secret>`

Store the public identifier for lookup and a verifier for the random secret. This supports indexed lookup and could allow a slow verifier for only the secret component. It is operationally clear but requires a token-format change, schema decisions for public ID and verifier fields, longer tokens, more implementation surface, and a compatibility plan. It remains a good future `v2` option if schema expansion is approved.

### Password KDF Only

bcrypt, Argon2, scrypt, or PBKDF2 alone are rejected for direct lookup of high-entropy API tokens because they do not provide efficient indexed lookup unless paired with a public identifier. They should not be chosen merely to silence CodeQL. Slow KDFs are appropriate for low-entropy user passwords, not as the sole lookup mechanism for generated bearer tokens.

## Decision

Choose `SHA-256 Lookup Digest` for the next implementation PR.

The selected design is preferred because:

- PR #107 already defines `cmf_live_` tokens with 32 random bytes.
- It avoids introducing an undocumented production pepper.
- It reuses the current unique `ApiKey.key` column through a versioned stored representation.
- It supports deterministic indexed lookup.
- It keeps application-secret rotation independent of API-key validity.
- It permits explicit dual-read compatibility for raw legacy records.

This decision is not yet approved for implementation merge. PR #109 must be corrected and merged before PR #110 proceeds, and PR #110 must then be rebased onto the corrected ADR merge.

## Next-Level Guardrails and Mandatory Acceptance Criteria

### A. Sequencing

PR #109 must merge before PR #110 proceeds. PR #110 must be rebased onto the corrected ADR merge before final review.

### B. Tenant Isolation

Every resource access must include authenticated team ownership:

```text
id = submitted resource ID
AND
teamId = auth.teamId
```

This applies to campaigns, leads, workflows, tasks, knowledge, and indirect service calls. Route handlers and service helpers must not rely on a bare submitted ID when tenant-owned data is read or mutated.

### C. Fastify API-Key Boundary

Do not simply make every `/v1` route public. The API adapter must require an explicit API-key route registry or route metadata declaring:

- route family;
- required scope;
- auth mode;
- throttle family.

The adapter must fail closed when a `/v1` route lacks an authorization declaration. Registered API-key routes must allow API-key-only clients without requiring a browser session.

### D. Trusted Requester Source

Failed-auth throttling and audit attribution must not trust raw client-supplied `x-forwarded-for`, `x-real-ip`, `cf-connecting-ip`, or any internal source header. The adapter must strip client-supplied internal source headers, derive source identity from trusted server or platform context, inject a server-controlled source identifier, and document trusted-proxy assumptions.

### E. Failed-Auth Throttling

Failed API-key authentication throttling must require:

- a pre-check before Prisma lookup;
- stable endpoint family keys, not raw dynamic paths;
- candidate-key changes that do not bypass limits;
- resource-ID changes that do not bypass limits;
- spoofed headers that do not bypass limits;
- bounded shared backend use where available;
- TTL and maximum-size eviction for local fallback;
- a bounded global failure bucket;
- explicit Redis-degraded behavior;
- successful traffic kept separate from failed-auth throttling;
- no raw keys or digests in throttle keys or logs.

### F. Audit Consistency

For key creation, once persistence succeeds, audit failure must not cause a `500` while withholding the one-time secret. Preferred behavior:

- return successful creation;
- return the raw secret once;
- catch audit failure separately;
- record only redacted operational metadata;
- emit an alert or metric.

Equivalent committed-mutation semantics apply to revocation.

### G. UI Contract

List responses must return a display-only field such as `displayKey`. Masked values must not be placed in a field named `key`.

The governance UI must display metadata for listed keys, never reveal or copy listed masked values as credentials, display the raw secret once after creation, provide an explicit one-time copy action, clear the raw value when dismissed or navigated away, and support scope selection or an explicitly approved route-specific default.

### H. Legacy Keys

No Stage 12A PASS is allowed until legacy inventory exists, owners are mapped, replacements are issued, legacy usage has ceased, legacy records are revoked, rollback requirements are satisfied, and dynamic abuse tests pass. Do not invent a retirement date.

### I. Rollback

Digest-aware authentication must remain deployed while any digest-backed keys exist. Rollback order:

1. disable new issuance;
2. retain digest-aware authentication;
3. retain legacy dual-read if required;
4. reissue affected keys only through a controlled owner workflow;
5. remove digest-aware authentication only when no digest records remain.

### J. Revocation

Repeated revocation of an already inactive key must return idempotent success. Cross-team and nonexistent IDs must remain non-enumerating `404`.

### K. Request Parsing

Authenticate and authorize before JSON parsing. Malformed authenticated JSON returns `400`. Unauthenticated malformed requests return the authentication response, not `500`.

### L. List Bounds

Key-management lists require a conservative hard cap or explicit cursor pagination. This does not close the broader sensitive-list finding unless all relevant routes are separately fixed.

## Token Format

Newly issued token:

`cmf_live_<64 lowercase hex characters>`

The 64 hex characters encode 32 random bytes generated server-side. Legacy tokens are recognized only as temporary compatibility inputs:

- `sk_live_<48 lowercase hex characters>`
- `cs_live_<48 lowercase hex characters>`

## Stored Representation

For new keys, store only:

`cmf_sha256_v1:<last4>:<sha256(rawToken)>`

The `last4` segment is safe display metadata. The digest must never be returned to clients or logged. Legacy records continue to have raw `sk_live_` or `cs_live_` values until rotation or a separately approved migration changes them.

## Authentication Flow

1. Read `x-api-key` and reject missing, malformed, or unknown formats with the same generic 401 behavior.
2. For `cmf_live_`, compute `cmf_sha256_v1:<last4>:<sha256(rawToken)>` and query `ApiKey.key`.
3. For `sk_live_` or `cs_live_`, temporarily perform the existing raw lookup path.
4. Require `isActive`.
5. Enforce required scope from server-defined route requirements.
6. Return `teamId`, `keyId`, and scopes to route code.
7. Update `lastUsedAt` without logging the token or stored representation.

## Creation and One-Time Display

Both `/settings/keys` and `/governance/keys` must issue `cmf_live_` tokens through the same helper, store only the versioned representation, and return the raw token exactly once in the create response. If the response is lost, the user must create a new key.

## Listing and Redaction

List responses must return metadata only:

- `id`
- `name`
- `scopes`
- `createdAt`
- `lastUsedAt`
- `isActive`
- `keyPrefix`
- `keyLastFour`
- `legacy`

They must not return raw tokens, digests, complete stored representations, pepper names, or secret material.

## Scope Enforcement

Scopes are server-defined and validated through the PR #107 allowlist. Client-supplied scopes must be normalized and rejected if unknown, duplicated, empty, malformed, or oversized. The implicit `admin` bypass in `validateApiKey()` must not remain unless it is added to the allowlist with a separate explicit approval; unknown legacy scopes do not grant access.

## Tenant and Role Enforcement

Creation, listing, and revocation remain ADMIN-only and team-scoped. Authentication derives tenant context only from the matched active key record. Tests must prove Team A cannot list, revoke, or use Team B keys.

## Revocation

Revocation must take effect immediately. The next implementation should prefer setting `isActive=false` for auditability unless hard delete is explicitly retained and tested. Authentication must reject inactive records.

## Rate Limiting

Failed API-key authentication throttling must not be keyed only by the candidate secret, because changing candidate keys would bypass it. The next implementation should use an HTTP-boundary identifier from trusted requester context:

- validated client IP/proxy chain according to deployment policy;
- endpoint;
- a bounded global failed-auth bucket;
- optional team/account dimension only after successful authentication.

Successful valid traffic must not receive misleading 401 responses from failed-auth throttling. Normal route quotas remain separate. If the shared rate-limit backend is unavailable in production, failed-auth throttling behavior must be explicit and conservative; in-memory fallback is acceptable only as a degraded or local-development mode. Logs must not contain raw tokens.

## Audit Consistency

Audit events may include key ID, team ID, action, scopes, legacy flag, and display metadata. Audit events must not include raw tokens, digests, complete stored representations, or secret material.

## Legacy-Key Transition

Choose dual-read without automatic rewrite.

Baseline:

- Continue validating legacy raw records temporarily.
- Do not automatically destroy legacy identity.
- Do not silently rewrite raw legacy records during authentication.
- Do not enforce a retirement date before new issuance is deployed.
- Expose legacy status only as safe metadata.
- Prepare owner-facing rotation instructions.
- Define measurable retirement prerequisites.

Rollout stages:

1. ADR approval: after PR #109 review findings are resolved and merged, `S12A-HIGH-001` may become `DESIGN_APPROVED_PENDING_IMPLEMENTATION`.
2. Atomic implementation PR ships new issuance plus new auth lookup together.
3. Monitor new vs legacy authentication counts, failed-auth counts, and legacy key inventory.
4. Owner-facing rotation instructions ship after new issuance is stable.
5. Retirement trigger requires proof that no active integrations depend on legacy keys or that owners have accepted forced rotation.
6. A separate retirement PR disables legacy dual-read.

Treatment:

- Legacy admin scope is not trusted unless explicitly allowlisted in the implementation PR.
- Unknown legacy scopes are denied for protected routes.
- Rollback keeps legacy raw lookup available and does not rewrite records.

## CodeQL Treatment

Use of SHA-256 for generated API-token lookup is a deliberate deterministic index, not password hashing. If CodeQL flags the helper as weak password hashing, the implementation PR should include a narrow code comment and PR/security-note disposition: the input is a server-generated 256-bit token, not a user password, and the digest is used only for lookup.

Do not weaken the design merely to silence CodeQL.

## Schema and Migration Impact

The selected design can reuse the current unique `ApiKey.key` column by storing `cmf_sha256_v1:<last4>:<digest>`.

No migration is approved by this ADR. If later reviewers decide separate metadata columns are required, use an additive expand-contract migration only:

- add nullable metadata/version columns first;
- add indexes without dropping current compatibility;
- backfill from versioned representations where possible;
- preserve legacy raw records during the compatibility window;
- roll back by keeping dual-read on the existing `key` column.

## Deployment Sequence

1. Correct and merge this ADR only.
2. Rebase `fix/security-api-key-issuance-auth-integration` onto the corrected ADR merge.
3. Add deterministic lookup helper and tests.
4. Update both creation routes and `validateApiKey()` in one PR.
5. Add the route registry or route metadata required for API-key-only `/v1` access.
6. Keep web UI changes limited to the one-time secret and metadata-only contract unless reviewers approve broader UI scope.
7. Verify metadata-only listing, one-time create response, legacy dual-read, revocation, scopes, admin enforcement, team isolation, safe audit, request parsing order, and failed-auth throttling.
8. Run final-head review and approved dynamic tenant, role, API-key, and failed-auth abuse tests.
9. Do not promote Stage 12A to PASS until all high findings are cleared.

## Rollback

Rollback must not invalidate all API keys. Because the chosen design does not depend on an application pepper, app-secret rotation and rollback are independent from API-key validity. During the compatibility window, legacy raw keys still authenticate through dual-read. If the implementation PR is rolled back, no automatic rewrite or legacy retirement has occurred.

Digest-aware authentication must remain deployed while digest-backed keys exist. If issuance must be stopped, disable new issuance first and keep authentication compatibility until owners have reissued affected keys through a controlled workflow and no digest records remain.

## Monitoring

Track without logging secrets:

- new key creation count;
- legacy key count;
- successful auth by key version;
- failed auth by endpoint/requester bucket;
- revoked key auth attempts;
- cross-tenant authorization denials;
- list/create/revoke audit events;
- rate-limit backend failures.

## Alternatives Rejected

- HMAC with dedicated pepper: rejected for this PR because no approved dedicated secret lifecycle exists.
- Public ID plus verifier: rejected for the next PR because it requires broader schema/token-format changes; acceptable future `v2`.
- Password KDF only: rejected because it is unsuitable for direct indexed lookup without a public identifier.
- PR #106 combined implementation: rejected as too broad and superseded by pure primitives plus this ADR.

## Consequences

Positive:

- New DB rows do not reveal usable API tokens after DB-read compromise.
- Lookup remains indexed and deterministic.
- No new production secret is introduced.
- Legacy compatibility is explicit and measurable.

Tradeoffs:

- Legacy raw records remain risky until rotated.
- Database write compromise remains a separate integrity threat.
- Listing needs metadata parsing from the stored representation unless separate metadata columns are later approved.

## Next Implementation PR

Branch:

`fix/security-api-key-issuance-auth-integration`

Required atomic scope:

1. deterministic lookup helper;
2. both key-creation routes: `/settings/keys` and `/governance/keys`;
3. `validateApiKey()`;
4. one-time secret response;
5. metadata-only listing;
6. strict server scope validation;
7. team and admin enforcement;
8. revocation;
9. API-key route tests;
10. legacy dual-read behavior;
11. safe audit handling;
12. source-aware failed-auth throttling.

Explicitly out of scope for the next PR:

- web UI changes;
- non-atomic active-key quota;
- premature legacy retirement;
- production migration;
- provider calls;
- Stage 12A PASS promotion.

Review budget recommendation: no more than 6 implementation files plus focused tests; keep the net code delta under roughly 500 lines unless reviewers approve expansion.

## Remaining Stage 12A Findings

`S12A-HIGH-001`: `OPEN / IMPLEMENTATION_BLOCKED_BY_REVIEW`

Overall: `STAGE_12A_BLOCKED_HIGH`

This ADR is the source-of-truth correction for review. It does not fix the finding, does not approve PR #110 for merge, and does not clear Stage 12A.
