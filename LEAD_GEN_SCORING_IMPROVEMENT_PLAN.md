# Lead-Gen & Scoring: Improvement Plan

Derived from `LEAD_GEN_SCORING_TRACE.md` (2026-08-24). This is a **plan, not a fix** — nothing in
this document has been implemented. Findings tracked as OPEN-68 through OPEN-74.

## Priority order and reasoning

**Tier 1 — fix first, they compound each other:**

1. **OPEN-68 — connect real tracking to the scorer.** `scoreAndPersist` should read
   `Email.openedAt`/`clickedAt` (already being written correctly) instead of the disconnected
   `Lead.dwellTimeMinutes`/`emailClicks`/`socialMentions` fields (which have no real writer). This
   alone fixes the root cause of "every score falls back to `freshLeadPrior`" and is the highest-
   leverage single change — everything downstream (Gap 2's clobber, and general score trustworthiness)
   gets better once real engagement data actually reaches the formula.
2. **OPEN-69 — stop the flat overwrite.** Once OPEN-68 is fixed, `scoreAndPersist` will legitimately
   compute more real, high scores — which makes an un-guarded flat overwrite of a Netjana-derived
   score more dangerous, not less. Change `scoreAndPersist` to the same monotonic-max policy
   `netjanaIntelService` already uses, or add an explicit "external signal overrides engagement
   re-score for N days" rule with a visible flag on the Lead record. Do this in the same PR as OPEN-68
   if possible — shipping one without the other leaves a half-fixed system.

**Tier 2 — close the intake dead ends (product decision, not just a bug fix):**

3. **OPEN-70 — let Netjana create leads, gated.** Two options, pick one with the user:
   (a) auto-create a Lead when an unmatched signal clears a confidence/tier threshold (needs a policy
   decision on false-positive tolerance), or (b) add a one-click "Create Lead" action on `/intel`'s
   Unmatched Signals card, keeping a human in the loop. (b) is lower-risk and faster to ship; (a) is
   closer to what the marketing narrative promises. Recommend shipping (b) first, revisit (a) once
   there's real usage data on match quality.
4. **OPEN-71 — wire up or kill `LandingLead`.** Confirm with the user whether public funnel-page
   capture is still a live intake channel worth finishing (wire `LandingLead` → `Lead`/`Campaign`
   creation) or whether it's been superseded by something else and should be explicitly deprecated
   (stop writing rows nobody reads, note it in the architecture docs). Either answer is fine; the
   current silent-dead-end state is not.

**Tier 3 — honesty/cleanup, low effort:**

5. **OPEN-72 — stop fabricating `optimalSendHour`.** Either omit the field from the API response until
   real open data exists (UI already has a null-check pattern for this), or label it "estimated
   default" in `LeadDetail.tsx`/`caller/page.tsx`. Trivial change, ships independently of everything
   else.
6. **OPEN-74 — rename `clusterLabel`/`churnRisk` comments** to describe what the heuristic actually
   does, not what algorithm it evokes. Pure comment/doc change, no behavior risk.

**Tier 4 — needs the user, not more tracing:**

7. **OPEN-73 — confirm Netjana's live production connectivity** (check `NETJANA_URL` and feature
   flags on the actual deployed environment). Once confirmed either way, align the marketing copy's
   "Layer 01" framing with reality — if Netjana isn't fully live, either finish the connection or make
   the homepage honest about beta/pilot status for that layer.

## What's intentionally out of scope for this plan

- No code changes shipped in this pass — tracing, diagramming, and planning only, per the scope of
  the request that produced this document.
- Consolidating the three independent scoring/state systems (`LeadScoringService`,
  `netjanaIntelService`, the channel-journey state machine) into one is **not** recommended as a Tier-1
  move. They serve genuinely different purposes (engagement scoring, external-signal reweighting,
  channel-touch state) and forcing them into one system is a bigger, riskier rewrite than the
  targeted fixes above. Revisit only if Tier 1+2 fixes reveal the split itself is the problem, not
  just the missing coordination between the pieces.

## Verification criteria once implemented

- OPEN-68: a lead with a real email open/click has non-zero `hasEngagementSignals` in
  `LeadScoringService`'s computed input, verified via a unit test asserting `scoreAndPersist` reads
  from `Email` rows.
- OPEN-69: a test asserting `scoreAndPersist` never lowers `intentScore` below a prior
  Netjana-attributed value without an explicit override flag.
- OPEN-70/71: a manual walkthrough — an unmatched signal or a landing-page submission visibly results
  in a new Lead appearing in `/leads` (or its explicit rejection/deprecation is documented).
- OPEN-72: `LeadDetail.tsx`/`caller/page.tsx` no longer show a specific hour without real open data
  backing it.
