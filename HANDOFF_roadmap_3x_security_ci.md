# Handoff: Roadmap 3.x security + CI batch (CraftMyFunnel)

Paste the prompt below into Claude Code at the repo root (`D:\fullstack`). State is as of `main` @ `8a5fff1` (2026-09-28, ~06:05 UTC). Five PRs from this batch are live. #579 took the prod API down and was reverted by #586; prod is back (see STEP 1). #588 and #589 then added a boot-memory budget to CI.

---

## Prompt for Claude Code

```
Context: a cloud Claude Code session just finished a batch of roadmap 3.x security and CI
work. main is at 8a5fff1. Everything below went through "Register Docker Images to GHCR" ->
"Deploy to Oracle VMs". #579's deploy took the prod API down, so #586 reverted it; the revert's
deploy (run #315, 04:42 UTC) passed its health check. Start with:
  git checkout main && git pull
  npm ci
  npx prisma generate --schema apps/api/prisma/schema.prisma   (only if api tests can't find the Prisma client)

MERGED IN THIS BATCH (ledger entries in OPEN_ITEMS.md)
- #581 OPEN-274: global rate-limit backstop (@fastify/rate-limit, 1000 req/min keyed on the
  verified user, IP fallback). apps/api/server.ts verifiedUserId + src/lib/rateLimitBackstop.ts.
  Targets CodeQL alert #46.
- #582 OPEN-275: CI gates - apps/web colocated tests (npm run test:colocated) and the apps/api
  dependency audit.
- #583 OPEN-276: API image - npm ci --omit=dev, runs as USER node (uid 1000). New ci.yml job
  "API Image Boot (/health)": migrates a Postgres service, boots api + worker, requires
  /health 200, one clean worker pass, non-root uid, CA mount readable, Chromium PDF render.
- #584: RAG ingestUrl - SSRF-guard DNS lookup raced against the 15s fetch deadline (OPEN-273 note).
- #577 OPEN-269 (roadmap 3.5): internal HMAC v2 (method/path/single-use nonce), webhook redirect
  refusal, CSV formula neutralization, 10 MiB upload cap. Plus CodeAnt fixes: client-errors
  CSV userId, JSON upload cap applies to the CSV not the envelope, replay-cache sweeps expired
  entries before evicting, NonRetryableJobError dead-letters 3xx webhook deliveries.
- #579 OPEN-270 (roadmap 3.3): REVERTED by #586. It had the DOMPurify landing sanitizer, worker
  CSP, parseBody + zod on hot routes, lead whatsappConsentAt as an ISO datetime.
- #588 + #589 OPEN-277 (after the incident): "API Image Boot" now runs api-boot and worker-boot
  with --memory=640m (like the VMs) and fails if api-boot uses more than API_BOOT_MEM_BUDGET_MIB
  (240; the CI baseline is ~200 MiB, and #579 added ~66 MiB there) after /health.

OPEN PRS
- #587 (draft) OPEN-278, roadmap 3.1 / I-07: internal-auth nonces and scraper-ingest signatures
  are also claimed in Redis (SET NX PX), so a replay sent to another api process is caught; it
  falls back to the per-process cache when there is no Redis. CI green, main merged in. The owner
  decides the merge and must confirm REDIS_URL is set on api-main (without it nothing changes).
- #585 (draft): this handoff doc.

STEP 1 - The #579 outage (resolved; context for re-landing 3.3)
Deploy run 36368134525 (361c977) recreated api-main at 02:08 UTC and the host hung until a global
OOM kill at 03:40:34 (host kernel log, see the OPEN-270 note). The api node process (anon-rss
~371 MB, vs ~254 MB on sha-30a40e7) ran on a 954 MB host with no swap and no container memory
limit. The ~120 MB extra is jsdom from isomorphic-dompurify, loaded at boot because loadRoutes
imports every route. The owner rebooted, switched the VM compose image to ${IMAGE_TAG:-latest},
pinned sha-30a40e7, and merged #586. OPEN-277 says the VMs now run with mem_limit: 640m; confirm
it on both hosts (a swapfile is optional), so an OOM restarts the container instead of hanging
the host.

STEP 2 - Owner actions (need the owner's credentials or decisions; do them WITH the owner)
a) Confirm REDIS_URL on api-main before merging #587.
b) Watch api logs for unexpected 401s on unusual paths: #577's v2 signature binds the raw
   pathname and fails closed if a proxy re-encodes it.
c) Confirm the external scraper signs every retry with a fresh X-Timestamp; an identical
   retry now gets 401 "Replayed request".
d) Confirm CodeQL alert #46 shows Fixed on main's code-scanning page.
e) After 3.3 re-lands (follow-up 1): cd workers/landing-pages && wrangler deploy, re-run
   apps/api/src/scripts/backfill-cloudflare-landing-pages.ts, and optionally add a CSP
   report-uri before the worker CSP goes enforcing.

STEP 3 - Follow-ups (ask the owner which to take; one PR each, smallest safe diff)
1. Re-land roadmap 3.3 (#579, OPEN-270) with sanitize-html instead of isomorphic-dompurify
   (+7 MiB measured, per OPEN-277); it must pass the 240 MiB boot budget. Keep the old allow-lists
   and URL/class/rel/target rules, and re-check the public page API output, since it sanitizes on
   every request.
2. Baseline migration for the six Landing* tables (LandingCampaign, LandingAsset,
   LandingWireframeOption, LandingPage, LandingLead, LandingEvent). They exist in prod only from
   an old prisma db push; no migration creates them (see
   20260916100000_campaign_landing_icp). Read prod's real shape first (read-only), write an
   idempotent migration (CREATE TABLE IF NOT EXISTS, guarded FKs, include LandingCampaign.icpId)
   in every mirrored prisma/migrations folder, then delete the LandingEvent exception in
   .github/workflows/ci.yml (known_gap= in "Require a full worker pass without errors") and
   update the OPEN-276 entry.
3. Remove v1 internal-HMAC acceptance in apps/api/src/lib/internalAuth.ts - ONLY once the web
   build containing #577 is live on Render and rolling back to a pre-#577 web build is ruled out.
4. Rest of roadmap 3.1 / I-07: the @fastify/rate-limit backstop store is still per-process. Its
   built-in Redis store fails open or 500s on Redis errors, so it needs a store with a local
   fallback.
5. /api/proxy buffers request bodies with no size cap (req.arrayBuffer()).
6. agent-audit CSV joins rows with a literal "\\n" (pre-existing bug).
7. DNS-rebinding TOCTOU in the SSRF guard (guard resolves, fetch resolves again): needs an undici
   dispatcher with a validated/pinned lookup; also fold the RAG and webhook fetches into one
   guarded-fetch helper.
8. API image: Trivy scan (docker-ghcr.yml scans only web), pin node:22-alpine by digest, split
   Chromium out of the api-main image (the worker needs it).
9. About 130 of 165 apps/api routes that read a JSON body have no schema; #579's parseBody + zod
   helper comes back when 3.3 re-lands.
10. Dead code, owner decides, do not delete unasked: apps/web CreditTopupModal.tsx,
   SettingsPanel.tsx -> settings/BillingSettings.tsx, modules/billing/ui/BillingPage.tsx have no
   importers. Their top-up buttons send only tierId (the API would 400) but are unreachable;
   the live /billing and /credits pages send country and state.

RULES AND GOTCHAS FROM THIS BATCH
- OPEN_ITEMS.md: every PR appends an OPEN-### bullet at the end of the sweep section, so
  parallel PRs always conflict there. When merging main into a branch keep EVERY entry, main's
  first and the PR's own entry last. Four times in this batch a merge silently dropped entries.
  Before pushing any merge of main, run this; it must print "ledger OK":
    node -e "const x=require('child_process').execSync;const ids=r=>new Set((x('git show '+r+':OPEN_ITEMS.md').toString().match(/^- \*\*OPEN-\d+ \(/gm)||[]).map(s=>s.slice(4,-2)));const m=ids('origin/main'),h=ids('HEAD');const lost=[...m].filter(i=>!h.has(i));console.log(lost.length?'DROPPED: '+lost.join(', '):'ledger OK')"
- A PR must be up to date with main to merge; after merging main in, wait for CI Gate again.
- Any main merge touching apps/**, packages/** or package*.json builds a new api image and
  deploys it to both VMs; docs-only merges don't.
- AGENT_RULES.md: no local docker build/compose. The CI job "API Image Boot (/health)" is the
  Docker check. Never run prisma db push in CI and never use --accept-data-loss.
- Deploy topology: one api-main host and one api-worker host (Oracle VMs, Caddy in front); web on
  Render. api-main has 954 MB RAM and no swap, so anything the api loads at boot counts. The
  api image runs as uid 1000, so anything bind-mounted into it (e.g.
  /opt/fullstack/config/prod-ca-2021.crt) must be readable by uid 1000.
- "Render Parity Gate" red with "Render Parity Build did not complete successfully" right after a
  newer push means the older run was cancelled, not a real failure.
- CodeAnt reviews drafts only when asked (@codeant-ai: review). Its nitpicks are optional. It has
  saved two learnings: a per-process replay cache is fine while there is one api process, and
  claiming the internal-auth nonce before the handler runs is intended.
- Before pushing: apps/api "npx vitest run" and "npx tsc -p tsconfig.strict.json --noEmit";
  apps/web "npm run typecheck", "npx vitest run tests/unit", "npx vitest run src", eslint on the
  changed files; actionlint for workflow edits.
```
