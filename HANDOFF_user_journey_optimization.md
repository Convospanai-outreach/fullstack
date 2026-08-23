# Handoff: User Journey Optimization (CraftMyFunnel)

Paste the prompt below into Claude Code at the repo root (`D:\fullstack`). File references are already verified against the current codebase.

---

## Prompt for Claude Code

```
Context: I mapped the CraftMyFunnel user journey (signup → activation → active use → upgrade)
and flagged 4 friction points. Goal: reduce drop-off at each flagged step and increase
Trial → Paid conversion, without adding new features — mostly UX sequencing, copy, and
progressive disclosure changes. Work through these one at a time, smallest safe diff first,
and don't touch anything outside the files listed per step unless you find a shared
component that needs the same fix.

STEP 1 — Landing / marketing site (friction)
File: apps/web/src/app/page.tsx
Problem: too much competing for attention before signup; conversion-critical page.
Fix: reduce to one primary CTA above the fold, defer secondary content. Check
apps/web/src/components/marketing/ for reusable hero/CTA components before writing new ones.

STEP 2 — Onboarding wizard (friction)
Files: apps/web/src/app/onboarding/page.tsx
       apps/web/src/modules/onboarding/ui/OnboardingChecklist.tsx
       apps/web/src/modules/onboarding/service/onboardingService.ts
       apps/web/src/modules/onboarding/api/progress.ts
       apps/web/src/components/onboarding/WelcomeTour.tsx
Problem: mailbox OAuth connect blocks progress; no visible step count; no skip option.
Fix: add a visible step indicator (X of 4), let users skip mailbox connect and explore
with sample/demo data, return to the skipped step later via the checklist. Check
onboardingService.ts for how progress state is tracked before adding a "skipped" state.

STEP 5 — Lead import / CSV (friction)
CORRECTION: the journey map lists /csv-ingestion, but that route is a 5-line stub.
The real, working import flow is apps/web/src/app/(dashboard)/leads/import/page.tsx
(255 lines). Fix the real one. apps/web/src/app/csv-ingestion/page.tsx is dead/legacy —
flag it for removal, don't build on it.
Files: apps/web/src/app/(dashboard)/leads/import/page.tsx
       apps/web/src/app/api/upload/csv/route.ts
       apps/web/src/components/import/ (check for existing mapping UI)
Problem: full-list CSV upload with column mapping is a hard stop for first-time users.
Fix: add a "try with 10 sample leads" path that skips file upload entirely, and
auto-map common column headers (name, email, company, title) with a preview before
commit.

STEP 10 (NEW) — Lead scoring is invisible on /leads (highest priority fix)
Files: apps/web/src/app/(dashboard)/leads/page.tsx
       apps/web/src/modules/scoring/service/LeadScoringService.ts
       apps/web/src/modules/scoring/types.ts
Problem: modules/scoring is fully built but only wired into /caller. The main /leads
list has a status column, no score column at all — the product's headline feature
(lead scoring) is never shown to the user.
Fix: add a score column + sort/filter to the leads list, and show score + rationale on
the lead detail view. Check LeadScoringService.ts for the score shape before rendering.

STEP 11 (NEW) — Playbooks hidden behind /tools, should live in campaign creation
Files: apps/web/src/app/(dashboard)/campaigns/new/page.tsx (or campaigns/[id]/edit)
       apps/web/src/app/(dashboard)/playbooks/page.tsx
       apps/web/src/modules/playbooks/playbookService.ts
       apps/web/src/lib/productFlags.ts (remove "playbooks" from HIDDEN_FEATURES once wired)
Problem: playbooks (reusable campaign templates) is a real, built feature but only
reachable via the generic /tools drawer. Campaign creation starts from a blank canvas.
Fix: add a "start from playbook" entry point directly inside campaign creation, pulling
from playbookService.ts. Keep /playbooks page for managing/editing playbooks separately.

STEP 12 (NEW) — Hunter Email Finder hidden, should be inline in ICP Builder / lead import
Files: apps/web/src/modules/hunter-email-finder/ui/EmailFinderPage.tsx
       apps/web/src/modules/hunter-email-finder/service/hunterService.ts
       apps/web/src/modules/icp-builder/ui/ICPListPage.tsx
       apps/web/src/app/(dashboard)/leads/import/page.tsx
       apps/web/src/lib/productFlags.ts (remove "hunter-email-finder" from HIDDEN_FEATURES once wired)
Problem: email discovery/verification is built and fully hidden. Users can import leads
with no valid email, which silently kills their first campaign (bounces, no replies).
Fix: add a "find/verify email" inline action during ICP Builder and lead import, not a
separate hidden tool page.

STEP 13 (NEW) — Enrichment has a service but zero UI anywhere
Files: apps/web/src/modules/enrichment/service/EnrichmentService.ts (backend only — no
       page, no hidden-tools entry, nothing. You will need to build a UI surface here.)
       apps/web/src/app/(dashboard)/leads/page.tsx (likely integration point)
Problem: EnrichmentService.ts exists but has no UI anywhere in the app, not even behind
/tools. Lead scoring (Step 10) depends on having enriched firmographic data to score
against — right now there's no way for a user to trigger enrichment at all.
Fix: scope this with me before building — decide whether enrichment runs automatically
on import (Step 5) or as a manual action on the leads list (Step 10), then wire a UI to
EnrichmentService.ts accordingly.

STEP 8 — Analytics / dashboard (friction)
Files: apps/web/src/modules/dashboard/ui/DashboardPage.tsx
       apps/web/src/modules/dashboard/ui/components/StatCard.tsx
       apps/web/src/modules/dashboard/api/stats.ts
       apps/web/src/modules/dashboard/service/dashboardService.ts
       apps/web/src/components/billing/UsageCard.tsx (trial-limit surfacing)
Problem: raw numbers (sends, replies) don't translate to perceived value; trial-limit
usage isn't visible until the user hits billing.
Fix: add a plain-language value line near StatCard ("X leads replied, Y hours saved"),
and surface UsageCard (or equivalent trial-limit indicator) persistently on the
dashboard, not just on the billing page.

CROSS-CUTTING
- First-reply notification: check apps/web/src/app/(dashboard)/inbox for where replies
  land, and confirm whether an in-app + email notification fires on first reply. If not,
  this is the highest-leverage activation signal on the whole map — add it.
- Billing/upgrade nudges: apps/web/src/modules/billing/ui/BillingPage.tsx,
  apps/web/src/components/billing/UpgradeModal.tsx — confirm upgrade prompts trigger off
  real usage thresholds, not a fixed trial-day countdown alone.

Do not refactor unrelated code in these files. Match existing patterns (check how other
modules structure ui/service/api split before adding new files). After each step, tell me
what changed and why, so I can verify against the journey map before moving to the next one.
```

---

## Reference: File map by journey step

| Step | Screen | Route | Key files |
|---|---|---|---|
| 1 ⚠ | Landing / marketing site | `/` | `apps/web/src/app/page.tsx`, `apps/web/src/components/marketing/` |
| 2 ⚠ | Onboarding wizard | `/onboarding` | `apps/web/src/app/onboarding/page.tsx`, `apps/web/src/modules/onboarding/*`, `apps/web/src/components/onboarding/WelcomeTour.tsx` |
| 3 | ICP Builder | `/icp-builder` | `apps/web/src/modules/icp-builder/*` |
| 4 | Campaign creation | `/campaigns` | `apps/web/src/app/(dashboard)/campaigns/*` |
| 5 ⚠ | Lead import / CSV | `/leads/import` (NOT `/csv-ingestion` — that route is a dead stub) | `apps/web/src/app/(dashboard)/leads/import/page.tsx`, `apps/web/src/app/api/upload/csv/route.ts` |
| 6 | Approvals (AI draft review) | `/approvals` | `apps/web/src/app/(dashboard)/approvals/*` |
| 7 | Inbox / replies | `/inbox` | `apps/web/src/app/(dashboard)/inbox/*` |
| 8 ⚠ | Analytics / dashboard | `/dashboard` | `apps/web/src/modules/dashboard/*` |
| 9 | Billing / upgrade | `/billing` | `apps/web/src/app/(dashboard)/billing/page.tsx`, `apps/web/src/modules/billing/*`, `apps/web/src/components/billing/*` |
| 10 (new) | Lead scoring, surfaced on Leads | `/leads` | `apps/web/src/app/(dashboard)/leads/page.tsx`, `apps/web/src/modules/scoring/*` |
| 11 (new) | Playbooks, surfaced in Campaign creation | `/campaigns/new` | `apps/web/src/modules/playbooks/playbookService.ts` |
| 12 (new) | Hunter Email Finder, surfaced in ICP/import | `/icp-builder`, `/leads/import` | `apps/web/src/modules/hunter-email-finder/*` |
| 13 (new) | Enrichment, needs a UI built from scratch | TBD | `apps/web/src/modules/enrichment/service/EnrichmentService.ts` |

Metrics already defined in the journey map (instrument these, don't invent new ones):
Signup → Activation rate, Time to First Campaign, Approval Turnaround, Trial → Paid
conversion, Reply Rate.

See also: `PRODUCT_REWORK_us_eu_india.md` for the market-positioning rework (US/EU/India,
competitive gaps vs HubSpot/Apollo/Lemlist) that sits above this journey-level fix list.
