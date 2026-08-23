# HANDOVER: Mautic + Twenty CRM Integration for CraftMyFunnel

Status: **Fine-tuned plan, not yet implemented.** This corrects and grounds the
original handover brief against the actual state of this repository and its
production infrastructure as of 2026-08-21. Nothing described here has been
built yet.

---

## 0. What changed from the original brief, and why

The original brief assumed a greenfield stack. This repo is not greenfield —
it has a live production topology and existing scaffolding that the brief
either duplicates or contradicts. Corrections:

1. **"CraftMyFunnel / Outreach App (`Convospanai-outreach/fullstack`)" is
   *this* repository**, not a separate checkout — `Convospanai-outreach/fullstack`
   is just the GitHub org/repo name baked into the production image tag
   (`ghcr.io/convospanai-outreach/fullstack/api:latest`). Do not scaffold a
   second app. `apps/web` is deployed on Vercel; `apps/api` runs on two
   Oracle Cloud VMs (`api-main`, `api-worker`) behind Caddy at
   `api.craftmyfunnel.live`, with managed Neon Postgres and managed Redis —
   **not** self-hosted. The new docker-compose stack below is additive: it
   stands up Mautic + Twenty CRM only, on their own VM. It does not include
   the outreach app itself and does not touch `apps/api`'s existing DB/Redis.

2. **`/lib/services/syncEngine.ts` is the wrong path.** This codebase's
   convention is `apps/api/src/modules/<domain>/service/<name>.ts` (see
   `apps/api/src/modules/crm-integration/service/crmService.ts`,
   `apps/api/src/modules/billing/service/stripeSubscriptionGateway.ts`). New
   code follows that layout, split into two modules (see Task 2).

3. **A generic CRM integration layer already exists.** `CrmIntegration`
   (Prisma model, `apps/api/prisma/schema.prisma:1052`) is provider-keyed
   (`@@unique([teamId, provider])`, currently `"HUBSPOT"`), stores
   `accessToken`/`refreshToken`/`expiresAt`/`fieldMapping`/`syncSettings`, and
   `crmService.ts` implements the exact search-by-email → update-or-create
   pattern Twenty needs. `Lead` already has `crmId`/`crmSyncedAt`. **Twenty
   CRM should be added as `provider: "TWENTY"` inside this existing service**,
   not as new tables or a new sync client. Mautic is not a CRM in this
   taxonomy (it's top-of-funnel, not pipeline) — it gets its own module.

4. **`client_slug` duplicates existing tenancy.** Every relevant model is
   already scoped by `teamId` (`Team`, `CrmIntegration`, `Lead`, ...). Don't
   add a parallel `client_slug` column. Use `teamId` internally for isolation;
   project it outward only as a slug value written into Mautic's custom
   contact field and Twenty's client-tag field, so the *external* systems can
   filter/segment by it even though our own DB isolates by `teamId`.

5. **`last_updated_by` is not a real Twenty field** — the brief invented it as
   a loop-guard mechanism. The actual guard is structural: the two directions
   consume disjoint event types and write to disjoint targets
   (`mautic.lead_points_change` → creates a Twenty Opportunity;
   `opportunity.updated` with stage `CLOSED_WON`/`CLOSED_LOST` → writes a
   Mautic *tag*, never a point change). Because neither direction's write
   re-triggers the other's trigger condition, no explicit loop-guard flag is
   needed — state the invariant in code comments instead of inventing a field.

6. **No idempotency rule for Opportunity creation.** `mautic.lead_points_change`
   fires on *every* point change, so a contact sitting above the 50-point
   threshold will re-fire the webhook on every subsequent point gain and
   create duplicate Opportunities unless promotion is marked. Fix: add a
   `promotedToOpportunityAt` timestamp (see Task on schema, §4) checked
   before creating; skip if already set.

7. **Both webhook endpoints were specified with no auth.** As written they'd
   be publicly reachable on `api.craftmyfunnel.live`. Reuse this repo's
   existing pattern: `routes/webhooks/stripe-billing/route.ts` verifies a
   signature header before touching the DB. Mautic and Twenty webhooks need
   the equivalent (see Task 3).

8. **Floating image tags are wrong for a pilot.** `twentycrm/twenty:latest`
   and `mautic/mautic:5-apache` must be pinned to specific versions so a pilot
   client's stack doesn't silently change under them.

---

## 1. Feasibility checks (must be run before writing code, answers are version-dependent)

| # | Question | How to check | Why it matters |
|---|---|---|---|
| F1 | ✅ **Confirmed 2026-08-21** via `twentyhq/twenty`'s own `packages/twenty-docker/docker-compose.yml`: `db` really is plain `image: postgres:16`, no extensions, just `POSTGRES_DB/USER/PASSWORD`. The brief's assumption was right. But their compose also requires a **dedicated Redis** (`image: redis`, `--maxmemory-policy noeviction`) and the `server`/`worker` containers need `ENCRYPTION_KEY`, `FALLBACK_ENCRYPTION_KEY`, `APP_SECRET`, and `STORAGE_TYPE`/`STORAGE_S3_*` (or local volume) — **none of these are in the brief's `.env.example`**. Server exposes a `curl http://localhost:3000/healthz` healthcheck; worker runs `yarn worker:prod` with `DISABLE_DB_MIGRATIONS=true`/`DISABLE_CRON_JOBS_REGISTRATION=true` (server owns migrations+cron registration, worker must not duplicate them). **Corrected pin: `v2.32.0`** — the repo's raw git tag list I checked earlier (`v2.9.0`) was stale/unsorted; Docker Hub (`hub.docker.com/r/twentycrm/twenty/tags`, checked directly) is the authoritative source and its newest semver tag is `v2.32.0`. Re-check at execution time regardless — this moves fast. | Task 4's `.env.example` was incomplete; fixed below. |
| F2 | Does Twenty expose an `upsertPerson`-style mutation, and does it support upsert-by-email at all? | Still open — this is workspace-schema-dependent (Twenty generates its GraphQL/REST API per workspace's object metadata) and can't be confirmed by reading the repo alone. After first boot, hit GraphQL introspection (or `/rest/open-api/core`) with a generated API key and inspect the schema directly. | The mutation name/shape is generated per-workspace/version; don't hardcode it from memory. |
| F3 | ✅ **Confirmed 2026-08-21** via `mautic/mautic`'s `app/bundles/ApiBundle/Config/config.php` (7.x branch): both `api_enabled` and `api_enable_basic_auth` **default to `false`**. The Mautic API is fully disabled out of the box — this isn't a maybe, it's a required setup step. There is no env-var hook for this in the official `mautic/docker-mautic` image (checked, no `MAUTIC_API_*` vars exist), so it must be done post-boot: either mount a `config/local.php` override that sets both flags, or go through Settings → Configuration → API Settings in the admin UI once, before any `mauticService.ts` call will work. Added as an explicit plan step (Task 4.5, new). | Confirms the brief's assumption was wrong, not just unverified — this is a hard blocker until done. |
| F4 | Will Caddy issue certs for Cloudflare-proxied (orange-cloud) subdomains? | Check whether HTTP-01 works through the proxy for `funnel`/`twenty`/`mautic` subdomains, or whether DNS-01 via Cloudflare API token is required. Note: DNS-01 needs a Cloudflare DNS module, which the **stock `caddy:2` image does not ship** — requires an `xcaddy`-built image or grey-clouding the three records during initial issuance. | Determines whether Task 1 ships a bare `Caddyfile` or a `Caddyfile` + custom `Dockerfile`. |
| F5 | Does Mautic see real visitor IPs behind Caddy + Cloudflare, or does every contact resolve to Cloudflare's edge IP? | Configure Mautic's trusted-proxy / `CLIENT_IP` settings; verify a test submission logs a real IP, not `172.x`/Cloudflare range. | Breaks geolocation and behavioral tracking — the entire top-of-funnel value prop — if wrong. |
| F6 | What VM shape is required to run Postgres 16 + Twenty (server+worker) + MariaDB + Mautic (web+cron) + Redis + Caddy without swap-thrashing? | Twenty's docs recommend ≥4 vCPU / ≥8GB RAM minimum for their own stack alone; add MariaDB+Mautic's ~2GB floor and headroom. Size a real OCI shape before provisioning. | Under-provisioning is the most common cause of a "working" pilot that silently degrades. |
| F8 | ✅ **Confirmed 2026-08-21**: the brief's `mautic/mautic:5-apache` targets a version that is **two majors behind current**. `mautic/mautic` on Docker Hub's newest tags today are `7.1.3-apache` (published 2026-07-07); `5-apache` still exists and gets patched (latest `5.2.11-apache`, 2026-06-03) but is legacy. `8.x` is already in active development on GitHub, unreleased. **Recommendation: pin `7.1.3-apache`**, not `5-apache` — verified 7.x still fires `mautic.lead_points_change` (constant unchanged, `app/bundles/LeadBundle/LeadEvents.php`) and still exposes `LeadApiController`, so nothing in the brief's webhook/API design breaks by moving up two majors. Only reason to stay on v5 would be a specific plugin/theme with a known v5-only dependency — none identified here, so default to 7.1.3 unless you know of one. | The brief's pin was outdated before this even started; using it as written would mean building against an old, soon-unsupported line for a pilot meant to run forward. |
| F7 | Resend SMTP on 465/587 — any sender domain/DKIM setup needed before Mautic can send transactional/drip email? | Confirm the sending domain is verified in Resend and SPF/DKIM/DMARC are set for `mautic.yourdomain.com` (or whichever "from" domain is used). | Mail deliverability failures are invisible until a client complains leads aren't getting drips. |

**Do not write `pushLeadToMautic`/`upsertLeadToTwenty`/`createTwentyOpportunity`
signatures as settled code until F2 and F3 are answered against the actual
deployed versions.** Treat their shape as TBD in the plan below.

---

## 2. Integration checks against this codebase

| # | Check | Answer / action |
|---|---|---|
| I1 | Where does new sync code live? | `apps/api/src/modules/mautic-integration/service/mauticService.ts` (new module) and an addition to the existing `apps/api/src/modules/crm-integration/service/crmService.ts` (add `provider: "TWENTY"` branch alongside the existing HubSpot branch). |
| I2 | Where do webhook routes live? | `apps/api/routes/webhooks/mautic/route.ts` and `apps/api/routes/webhooks/twenty/route.ts`, following the existing per-provider folder convention (`stripe-billing`, `stripe-connect`, `razorpay`). `server.ts`'s file-based route loader auto-registers any `route.ts` under `routes/`, and `/webhooks` is already in the adapter's public-path allowlist (`server.ts:161-185`) — new routes need their own signature/secret check inside the handler, same as `stripe-billing/route.ts` does, since the path being "public" only means it skips session auth, not that it's unauthenticated. |
| I3 | Schema changes needed? | Add to `Lead`: `mauticContactId String?`, `mauticSyncedAt DateTime?`, `promotedToOpportunityAt DateTime?`. **This repo has three separate Prisma schemas** (`apps/api/prisma/schema.prisma`, `apps/web/prisma/schema.prisma`, `packages/db/prisma/schema.prisma`) that must stay in sync — the in-flight Stripe billing work on this branch demonstrates the pattern (identical migration dir names across all three). Every field addition here needs a migration in all three, verified with `npm run db:schema:compare`. |
| I4 | Twenty CRM ID storage? | Reuse `Lead.crmId` / `Lead.crmSyncedAt` (already exist, already provider-agnostic) — do not add `twentyPersonId`. |
| I5 | Tenancy/isolation? | Use `teamId` (already present everywhere) for internal isolation; write it as a slug into Mautic's custom contact field and a Twenty tag/field for external segmentation. No new isolation column. |
| I6 | Auth for outbound calls to Mautic/Twenty? | Store per-team Mautic Basic-Auth or OAuth2 credentials and Twenty API key the same way `CrmIntegration.accessToken`/`refreshToken` already store HubSpot's, or — if Mautic/Twenty are single shared instances serving all 3 pilot clients rather than per-team — store as server env vars (`MAUTIC_USERNAME`/`MAUTIC_PASSWORD`, `TWENTY_API_KEY`) and skip the per-team credential path entirely. **This is a decision, not a default — see §5.** |
| I7 | Which Mautic crons are required? | The brief only says "essential console crons." Concretely: `mautic:segments:update`, `mautic:campaigns:update`, `mautic:campaigns:trigger`, `mautic:emails:send`. Missing `segments:update` or `campaigns:trigger` is the most common reason a Mautic pilot looks "up" but nothing actually fires. |

---

## 3. Branching

This branch (`feat/stripe-subscription-billing`) has unrelated, in-flight,
uncommitted Stripe billing changes across `apps/api`, `apps/web`, and
`packages/db` schemas. **Do not build this feature on top of it.** Start a
fresh branch off `main` (or off the Stripe branch only after it's merged, if
sequencing requires it) before Task 1 begins.

---

## 4. Implementation plan

```
1. Provision + size the OCI VM (per F6) for Mautic+Twenty only
   → verify: VM up, ports 80/443 reachable, DNS A records for the 2 new
     subdomains (funnel subdomain is NOT part of this stack — outreach app
     is already deployed) point at it.

2. Write docker-compose.mautic-twenty.yml (Caddy, redis, twenty-db,
   twenty-server, twenty-worker, mautic-db, mautic-web, mautic-cron) with
   pinned image tags — `twentycrm/twenty:v2.32.0` (F1, Docker Hub-verified
   current) and `mautic/mautic:7.1.3-apache` (F8, Docker Hub-verified
   current; **not** the brief's `5-apache`, which is two majors behind), and
   Caddyfile per F4's answer (bare vs xcaddy image). Base the
   twenty-db/twenty-server/twenty-worker service definitions directly on
   Twenty's own confirmed compose (F1) rather than re-deriving them — same
   image, same `ENCRYPTION_KEY`/`APP_SECRET`/`STORAGE_TYPE` env vars, worker
   with `DISABLE_DB_MIGRATIONS=true` and `DISABLE_CRON_JOBS_REGISTRATION=true`.
   Twenty's redis is dedicated to Twenty — don't share it with Mautic's cache
   needs if Mautic also wants Redis, use separate logical DBs or separate
   containers.
   → verify: `docker compose up -d` boots all 8 containers with no restart
     loops; Caddy issues valid certs for both subdomains; Twenty's
     `/healthz` returns 200.

2.5. Enable Mautic's API (F3, confirmed disabled by default): mount a
     `config/local.php` override setting `api_enabled: true` and
     `api_enable_basic_auth: true` (or do it once through Settings →
     Configuration → API Settings in the admin UI post-install) before any
     integration code is written against it.
   → verify: `POST /api/contacts/new` with Basic Auth returns 201/200
     instead of a 401/API-disabled error.

3. Resolve F1-F7 against the pinned versions actually running
   → verify: each row in §1's table has a written answer, not an assumption.

4. Add Lead fields (mauticContactId, mauticSyncedAt, promotedToOpportunityAt)
   to all three Prisma schemas + migrations
   → verify: `npm run db:schema:compare` passes; migrations applied in dev.

5. Build apps/api/src/modules/mautic-integration/service/mauticService.ts
   (push lead → Mautic contact, tagged with client slug + client_slug custom
   field) using the auth mechanism resolved in F3/I6
   → verify: manual POST creates/updates a real Mautic contact by email,
     idempotently (resubmit same email → no duplicate).

6. Extend crmService.ts with a TWENTY branch (search-by-email → update-or-
   create Person via the mutation confirmed in F2), reusing Lead.crmId
   → verify: manual call creates/updates a real Twenty Person by email,
     idempotently.

7. Build routes/webhooks/mautic/route.ts: verify an auth secret, parse
   mautic.lead_points_change, check points >= 50 AND
   promotedToOpportunityAt IS NULL, create Twenty Opportunity, set
   promotedToOpportunityAt
   → verify: point change below 50 does nothing; crossing 50 creates exactly
     one Opportunity; a further point gain does not create a second one.

8. Build routes/webhooks/twenty/route.ts: verify an auth secret, parse
   opportunity.updated, on stage CLOSED_WON/CLOSED_LOST write the
   corresponding tag to the Mautic contact (via mauticService)
   → verify: closing an Opportunity in Twenty results in the matching tag
     appearing on the Mautic contact, and does not itself trigger a new
     points-change webhook (confirms the structural loop-guard from §0.5
     actually holds, not just in theory).

9. .env.example with the full var list from the original brief, plus vars
   confirmed missing per F1 (`TWENTY_ENCRYPTION_KEY`,
   `TWENTY_FALLBACK_ENCRYPTION_KEY`, `TWENTY_APP_SECRET` is already listed but
   also needs `TWENTY_STORAGE_TYPE`/S3 vars if not using local volume
   storage) and `MAUTIC_WEBHOOK_SECRET` / `TWENTY_WEBHOOK_SECRET` (needed for
   step 7-8's auth, the brief omitted these)
   → verify: every var referenced in code and in the compose file from step 2
     has a matching `.env.example` entry.

10. End-to-end pilot test with one real client_slug
    → verify: form submit -> Mautic contact with correct tag -> manually
      cross 50 points -> Twenty Person + Opportunity appear -> close won ->
      Mautic tag updates -> resubmit same email anywhere in the chain ->
      no duplicates in Mautic or Twenty.
```

---

## 5. Decisions required before execution (with recommendation)

1. **New OCI VM shape/cost for Mautic+Twenty.** Recommend a dedicated VM
   separate from `api-main`/`api-worker` (isolates blast radius; those two
   already carry production traffic) — confirm budget for a 4vCPU/8GB+
   instance per F6.
2. **Per-team vs. shared Mautic/Twenty instance (I6).** The brief's
   `client_slug` language implies one shared instance serving all 3 pilot
   clients, segmented by tag/custom-field — recommend that over provisioning
   3 separate Mautic/Twenty stacks, since it's cheaper to operate and the
   existing `teamId`-based isolation pattern in this codebase already assumes
   single-instance-multi-tenant.
3. **Caddy image (F4).** Recommend grey-clouding the 2 new subdomains during
   initial cert issuance (simplest, no custom image) unless there's a
   standing reason Cloudflare must stay orange-clouded for these subdomains.

---

## 6. Explicit non-goals

- Not touching `apps/api`'s production Postgres (Neon) or Redis.
- Not modifying the existing HubSpot branch of `crmService.ts`.
- Not building a second outreach app — CraftMyFunnel's existing frontend/API
  is the outreach tier already referenced in the brief's architecture diagram.
