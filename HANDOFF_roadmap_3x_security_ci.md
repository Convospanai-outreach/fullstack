# Handoff: Roadmap 3.x security + CI batch (CraftMyFunnel)

Paste the prompt below into Claude Code at the repo root (`D:\fullstack`). State is as of `main` @ `361c977` (2026-09-28, ~01:50 UTC). All six PRs from this batch are merged and no PRs are open.

---

## Prompt for Claude Code

```
Context: a cloud Claude Code session just finished a batch of roadmap 3.x security and CI
work. Everything below is squash-merged to main (361c977) and was deployed through
"Register Docker Images to GHCR" -> "Deploy to Oracle VMs". Start with:
  git checkout main && git pull
  npm ci            (#579 added isomorphic-dompurify; without it 3 landing-agent test files fail to load)
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
- #579 OPEN-270 (roadmap 3.3): DOMPurify landing sanitizer, worker CSP, parseBody + zod on hot
  routes. Plus lead whatsappConsentAt must be an ISO datetime, CodeQL test-regex fix.

STEP 1 - Verify the last deploy
The "Deploy to Oracle VMs" run for 361c977 (#579) had not started at handoff (its GHCR build was
running). Confirm it succeeded: gh run list --workflow deploy-oracle.yml -L 3. It health-checks
and auto-rolls back; if it failed, read the job log and report before changing anything.

STEP 2 - Owner actions (need the owner's credentials or decisions; do them WITH the owner)
a) cd workers/landing-pages && wrangler deploy  - #579's worker headers are not live until then.
b) Re-run apps/api/src/scripts/backfill-cloudflare-landing-pages.ts so already-published pages
   get a scriptHash (until then their report-only CSP flags their own script).
c) Watch api logs for unexpected 401s on unusual paths: #577's v2 signature binds the raw
   pathname and fails closed if a proxy re-encodes it.
d) Confirm the external scraper signs every retry with a fresh X-Timestamp; an identical
   retry now gets 401 "Replayed request".
e) Confirm CodeQL alert #46 shows Fixed on main's code-scanning page.
f) Optional: add a CSP report-uri endpoint before switching the worker CSP to enforcing.

STEP 3 - Follow-ups (ask the owner which to take; one PR each, smallest safe diff)
1. Baseline migration for the six Landing* tables (LandingCampaign, LandingAsset,
   LandingWireframeOption, LandingPage, LandingLead, LandingEvent). They exist in prod only from
   an old prisma db push; no migration creates them (see
   20260916100000_campaign_landing_icp). Read prod's real shape first (read-only), write an
   idempotent migration (CREATE TABLE IF NOT EXISTS, guarded FKs, include LandingCampaign.icpId)
   in every mirrored prisma/migrations folder, then delete the LandingEvent exception in
   .github/workflows/ci.yml (known_gap= in "Require a full worker pass without errors") and
   update the OPEN-276 entry.
2. Remove v1 internal-HMAC acceptance in apps/api/src/lib/internalAuth.ts - ONLY once the web
   build containing #577 is live on Render and rolling back to a pre-#577 web build is ruled out.
3. Move the in-memory replay caches (internal-auth nonces, scraper-ingest signatures) to Redis
   (roadmap 3.1 / I-07). Required before a second api-main process exists.
4. /api/proxy buffers request bodies with no size cap (req.arrayBuffer()).
5. agent-audit CSV joins rows with a literal "\\n" (pre-existing bug).
6. DNS-rebinding TOCTOU in the SSRF guard (guard resolves, fetch resolves again): needs an undici
   dispatcher with a validated/pinned lookup; also fold the RAG and webhook fetches into one
   guarded-fetch helper.
7. API image: Trivy scan (docker-ghcr.yml scans only web), pin node:22-alpine by digest, split
   Chromium out of the api-main image (the worker needs it).
8. About 130 of 165 apps/api routes that read a JSON body still have no schema; reuse #579's
   parseBody + zod pattern.
9. Dead code, owner decides, do not delete unasked: apps/web CreditTopupModal.tsx,
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
- AGENT_RULES.md: no local docker build/compose. The CI job "API Image Boot (/health)" is the
  Docker check. Never run prisma db push in CI and never use --accept-data-loss.
- Deploy topology: one api-main host and one api-worker host (Oracle VMs, Caddy in front); web on
  Render. The api image runs as uid 1000, so anything bind-mounted into it (e.g.
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
