# TODO: Mautic + Twenty CRM Integration

Implementation checklist derived from `HANDOVER_CLAUDE_CODE.md` (read that
first for the *why* behind each item). Work top to bottom — later phases
depend on earlier ones being verified, not just done.

## Phase 0 — Decisions (blocking, need your answer before Phase 1)

- [ ] Confirm OCI VM shape/budget for a **new, dedicated** VM (not
      `api-main`/`api-worker`) — recommend ≥4 vCPU / ≥8GB RAM (§5.1)
- [ ] Confirm **one shared** Mautic + Twenty instance for all 3 pilot clients,
      segmented by `teamId`-derived slug, vs. one stack per client (§5.2)
- [ ] Confirm grey-clouding the 2 new Cloudflare subdomains during initial
      cert issuance, vs. building a custom xcaddy image for DNS-01 (§5.3)
- [ ] Confirm branch strategy: fresh branch off `main`, not
      `feat/stripe-subscription-billing` (§3)

## Phase 1 — Infra provisioning

- [ ] Provision the OCI VM per Phase 0's sizing decision
- [ ] Point `twenty.<domain>` and `mautic.<domain>` A records at the new VM
      (Cloudflare proxy mode per Phase 0)
- [ ] Confirm port 80/443 reachable on the VM (two-layer firewall: VM
      iptables **and** OCI Security List/NSG — see `feedback_oci_two_layer_firewall`)

## Phase 2 — Compose stack

- [ ] Write `docker-compose.mautic-twenty.yml`: `caddy`, `redis`, `twenty-db`,
      `twenty-server`, `twenty-worker`, `mautic-db`, `mautic-web`,
      `mautic-cron` — pin `twentycrm/twenty:v2.32.0` and
      `mautic/mautic:7.1.3-apache` (re-verify both tags are still current on
      Docker Hub before pinning — this moves fast)
- [ ] `twenty-db`: plain `postgres:16`, no extensions (confirmed against
      Twenty's own compose)
- [ ] `twenty-server`/`twenty-worker`: set `ENCRYPTION_KEY`,
      `FALLBACK_ENCRYPTION_KEY`, `APP_SECRET`, `STORAGE_TYPE` (+S3 vars if not
      local volume); worker gets `DISABLE_DB_MIGRATIONS=true` and
      `DISABLE_CRON_JOBS_REGISTRATION=true`
- [ ] Give Twenty its own dedicated `redis` container/logical DB — don't share
      with Mautic
- [ ] Write `Caddyfile` (bare `caddy:2` if grey-clouded, else xcaddy build
      with the Cloudflare DNS module for DNS-01)
- [ ] Configure Mautic's trusted-proxy / `CLIENT_IP` settings so visitor IPs
      survive Caddy + Cloudflare (F5)
- [ ] `docker compose up -d` — verify all 8 containers boot, no restart loops
- [ ] Verify Caddy issues valid certs for both subdomains
- [ ] Verify Twenty's `/healthz` returns 200

## Phase 3 — Mautic API enablement (confirmed OFF by default — required, not optional)

- [ ] Mount a `config/local.php` override (or use the admin UI once) setting
      `api_enabled: true` and `api_enable_basic_auth: true`
- [ ] Verify `POST /api/contacts/new` with Basic Auth returns 200/201, not 401
- [ ] Enable and verify Mautic crons are running: `mautic:segments:update`,
      `mautic:campaigns:update`, `mautic:campaigns:trigger`,
      `mautic:emails:send`

## Phase 4 — Remaining feasibility checks (version-dependent, do against the live stack)

- [ ] F2: introspect Twenty's GraphQL schema (or `/rest/open-api/core`) with a
      generated API key — confirm the exact upsert-by-email mutation name and
      shape before writing any code against it
- [ ] F7: confirm Resend sending domain is verified with SPF/DKIM/DMARC set
      for whichever "from" domain Mautic uses

## Phase 5 — Schema changes (all three Prisma schemas, kept in sync)

- [ ] Add to `Lead` in `apps/api/prisma/schema.prisma`: `mauticContactId
      String?`, `mauticSyncedAt DateTime?`, `promotedToOpportunityAt
      DateTime?`
- [ ] Mirror the same fields + migration in `apps/web/prisma/schema.prisma`
- [ ] Mirror the same fields + migration in `packages/db/prisma/schema.prisma`
- [ ] Run `npm run db:schema:compare` — must pass
- [ ] Apply migrations in dev, confirm no drift

## Phase 6 — Mautic integration module

- [ ] Create `apps/api/src/modules/mautic-integration/service/mauticService.ts`
      — push lead → Mautic contact, tagged with client slug + custom field,
      using auth resolved in Phase 3
- [ ] Verify: manual call creates a Mautic contact by email
- [ ] Verify: resubmitting the same email updates, doesn't duplicate

## Phase 7 — Twenty integration (extend existing crmService, don't fork it)

- [ ] Add a `TWENTY` branch to `apps/api/src/modules/crm-integration/service/crmService.ts`
      alongside the existing `HUBSPOT` branch — search-by-email →
      update-or-create Person, using the mutation confirmed in Phase 4/F2
- [ ] Reuse `Lead.crmId` / `Lead.crmSyncedAt` — do not add
      Twenty-specific ID columns
- [ ] Verify: manual call creates a Twenty Person by email
- [ ] Verify: resubmitting the same email updates, doesn't duplicate

## Phase 8 — Webhook: Mautic → Twenty

- [ ] Create `apps/api/routes/webhooks/mautic/route.ts`
- [ ] Verify an auth/signature secret (`MAUTIC_WEBHOOK_SECRET`) before
      touching the DB — do not leave it open like the original brief spec'd
- [ ] Parse `mautic.lead_points_change`
- [ ] Guard: only act if `points >= 50 AND promotedToOpportunityAt IS NULL`
- [ ] On trigger: create Twenty Opportunity, then set
      `promotedToOpportunityAt`
- [ ] Verify: point change below 50 does nothing
- [ ] Verify: crossing 50 creates exactly one Opportunity
- [ ] Verify: a further point gain after promotion does **not** create a
      second Opportunity

## Phase 9 — Webhook: Twenty → Mautic

- [ ] Create `apps/api/routes/webhooks/twenty/route.ts`
- [ ] Verify an auth/signature secret (`TWENTY_WEBHOOK_SECRET`) before
      touching anything
- [ ] Parse `opportunity.updated`
- [ ] On stage `CLOSED_WON` or `CLOSED_LOST`: write the corresponding tag to
      the Mautic contact via `mauticService`
- [ ] Verify: closing an Opportunity in Twenty updates the matching Mautic
      contact's tag
- [ ] Verify: that tag write does **not** itself fire a new
      `lead_points_change` webhook (confirms the structural loop-guard holds
      in practice, not just in theory)

## Phase 10 — Env template

- [ ] Write `.env.example` covering: networking domains, Twenty vars
      (`TWENTY_DB_PASSWORD`, `TWENTY_ENCRYPTION_KEY`,
      `TWENTY_FALLBACK_ENCRYPTION_KEY`, `TWENTY_APP_SECRET`,
      `TWENTY_STORAGE_TYPE`/S3 vars if applicable, `TWENTY_API_KEY`,
      `TWENTY_API_URL`), Mautic vars (`MAUTIC_DB_PASSWORD`,
      `MAUTIC_DB_ROOT_PASSWORD`, `MAUTIC_BASE_URL`, `MAUTIC_USERNAME`,
      `MAUTIC_PASSWORD`), `REDIS_PASSWORD`, Resend SMTP vars,
      `MAUTIC_WEBHOOK_SECRET`, `TWENTY_WEBHOOK_SECRET`
- [ ] Cross-check every var referenced in Phase 2's compose file and Phase
      6-9's code has a matching `.env.example` entry

## Phase 11 — End-to-end pilot verification

- [ ] Pick one real pilot `teamId`/client slug for the test
- [ ] Submit a funnel form → confirm Mautic contact created with correct
      client slug tag
- [ ] Manually push that contact's points ≥ 50 → confirm exactly one Twenty
      Person + Opportunity created
- [ ] Close the Opportunity as Won → confirm Mautic contact tag updates
      accordingly
- [ ] Resubmit the same email at every stage above → confirm no duplicates
      anywhere in Mautic or Twenty
- [ ] Confirm nothing in this feature touched `apps/api`'s production Neon
      Postgres, production Redis, or the existing HubSpot `crmService.ts`
      branch
