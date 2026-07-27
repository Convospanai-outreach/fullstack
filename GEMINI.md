CraftMyFunnel — Agent Ground Rules

Read this file in full before touching any code. If a request conflicts with a rule here, stop and surface the conflict — do not silently choose one side.

Tradeoff: Below guidelines bias toward caution over speed, and toward asking over guessing. This codebase has already been damaged once by an agent that reported success on stubbed, mocked, or partially-wired features. The cost of a clarifying question is seconds. The cost of a confidently wrong "done" is a re-discovery cycle days later. For genuinely trivial tasks (typo fix, copy change, one-line config), use judgment and don't over-process — but "trivial" must be true, not assumed.

---

### 0. Evidence & Reporting Standard (read this section first, every time)

This section exists because "done" has been asserted without proof, repeatedly, in ways that were only caught by an outside reviewer re-checking the trace. It is not optional and it is not satisfied by writing more confidently.

**A. Every claim is one of four kinds — label it as such, even implicitly through how you phrase it:**
- *Code inspection only* — "Reading `x.ts`, this appears to do Y." You have not run anything.
- *Local execution* — you ran a command in this session and are pasting its actual, full output.
- *CI execution* — you have the actual Actions run URL or job log for the actual pushed commit, not the workflow file that would run it.
- *Production/live confirmation* — you (or the human) directly observed the running system (SSH'd in, checked a live dashboard, sent a real message and watched it arrive).

Never write a sentence that reads like tier 2–4 when what you actually have is tier 1. "Confirmed," "verified," "PASS," and "✅" are tier 2+ words — do not use them for something you only read.

**B. No numeric or percentage score of any kind** ("97/100," "25/25 checks," "100% ready") unless every point behind it is a named, individually-checkable line item with its own evidence attached in the same report. An unrubriced score is worse than no score — it borrows the authority of measurement without the substance. If asked for a readiness summary, give a plain-language list of what's confirmed vs. open instead.

**C. Never report a third-party API's or library's behavior from memory as fact**, especially anything with a documented history of surprising behavior (e.g., "Gmail preserves custom headers," "this endpoint is idempotent by default"). Either cite a primary source (official docs, changelog) or say "assumed, not confirmed — needs an empirical test," and propose that test.

**D. "Local" and "CI" and "production" are different states — say which one you mean.** A report may not describe test/typecheck/coverage/concurrency results as unqualified facts if they were only run locally and the actual CI workflow has not been observed completing on the actual pushed commit. If CI hasn't run yet, say so plainly: "verified locally; CI run on this commit not yet observed."

**E. Any new verification script must fail loudly.** If it detects a bad result, it must exit non-zero (or throw) — never log a failure message and exit 0. State explicitly, in the report, that you confirmed this (i.e., you deliberately made the check fail once, to confirm the script actually stops the build/exits non-zero, not just that it runs).

---

### 1. Background Task Discipline (hard stop)

The single most repeated failure in this project's history: launching a background task (typecheck, test, coverage), writing "waiting for result," and then running the next command — including `git add`/`commit`/`push` — before that task's log has actually been fetched and read.

**Rule: no command may follow a background/async task until you have fetched its full output and it's visibly quoted in your own working trace.** Not the last 2–4 lines by default — enough of the log to see the actual pass/fail line, expanding to the full file if the tail is ambiguous. If you catch yourself about to run `git commit` while a task result is still "pending" or "waiting" — stop. Wait. Fetch. Read. Then proceed.

If a background task's log cannot be fetched for some reason (tooling issue, timeout), say that explicitly and do not commit until it can be, or the human explicitly waives it for that one commit.

---

### 2. Persistent Open-Items Ledger

Maintain `OPEN_ITEMS.md` at the repo root. Every finding from any audit, review, or self-identified gap — yours or a human reviewer's — gets a line in it the moment it's raised, and stays there until explicitly closed.

**Every task report, regardless of how unrelated the current task seems, ends with a ledger reconciliation:** each existing open item is marked one of:
- **Resolved** — with the evidence (per §0.A) attached inline, not just a reference back to an old commit.
- **Still open** — restated in one line so it's visibly carried forward, not silently dropped because a newer report superseded it.
- **Deferred** — with the explicit reason and confirmation the human accepted the deferral (a deferral you decided on your own is not a deferral, it's a drop).

An item may never simply disappear from a report because attention moved elsewhere. If you're not sure whether something old is still open, say "status unknown, needs re-check" rather than omitting it.

---

### 3. Scope Control

No new feature, channel, subsystem, or "phase" may be started without an explicit go-ahead from the human, stated as such in your plan before you start (per §2, Think Before Coding, below). If you notice something adjacent that seems worth building, propose it and stop — do not start building it and fold the result into a later "what's been done" summary as though it had been requested. A summary of accomplished work must only contain things that were actually asked for; anything else goes in a clearly separate "unrequested, built anyway — needs your sign-off" section, never blended in.

---

### Coverage & Multi-Provider Verification Rule (First-Time-Right)

1. **Mandatory Test Companion for New Files**:
   - Every newly created TypeScript service, provider, or utility file in `src/` MUST have a matching unit test file in `tests/unit/` covering success, failure, and edge case branches before commit.
   - If the test is a unit test with mocked dependencies (e.g., mocked Prisma/DB client), say so explicitly in the report. A mocked test proves the code branches correctly given an assumed input — it does not prove the real dependency (a real database, a real API) behaves that way. Do not let "tests pass" imply the latter when only the former is true.

2. **Pre-Push Coverage Gate Check**:
   - Before pushing any feature branch or claiming task completion, execute:
     `npm run test:coverage --workspace apps/web`
   - All statement, branch, function, and line coverage metrics MUST pass the configured Vitest thresholds with 0 errors.
   - If coverage drops from the prior commit, say so and give one line of why (new code without matching tests, etc.) — don't let it drift silently across several commits.

3. **RFC 5322 Message-ID Compliance**:
   - Outbound email providers MUST generate an explicit RFC 5322 `Message-ID: <uuid@domain>` header and store that exact string in `Email.providerId` to ensure `In-Reply-To` reply detection matches correctly.
   - Because third-party providers (Gmail API, Microsoft Graph) have documented histories of overwriting or not preserving custom headers, this specific claim requires empirical confirmation per §0.C before being marked resolved — not an assumption about how the API "should" behave.

---

### 1. Think Before Coding

Don't assume. Don't hide confusion. Surface tradeoffs.

Before implementing anything:

State your assumptions explicitly, in writing, before you start editing. If an assumption is load-bearing (the fix depends on it being true), verify it in the code first — don't assume "Google Workspace" and "Connected Mailboxes" are already unified just because a prior commit claimed so. Check.
If multiple interpretations of the request exist, present them — do not silently pick the one that's easiest to implement.
If a simpler approach exists than the one implied by the request, say so and propose it. Push back when the request would add complexity the product doesn't need yet.
If something is unclear — an ambiguous metric ("Signal Capture"), an undefined success state, a data model that doesn't obviously exist — stop. Name exactly what's confusing. Ask. Do not invent a plausible-sounding definition to keep moving.
Never report an assumption as a fact in your summary. "I wired X" and "I assumed X meant Y and wired that" are different sentences — use the correct one.

Test: if a reviewer reads your plan and asks "wait, how do you know that's true?" — and the honest answer is "I didn't check, I inferred it" — you were supposed to stop and ask before this point.

### 2. Simplicity First

Minimum code that solves the problem. Nothing speculative.

No features beyond what was explicitly asked for.
No abstractions for single-use code (no provider-abstraction layer for one provider unless multiple providers were actually requested — check §5 before assuming this applies to the AI router, which was explicitly asked to be provider-agnostic).
No "flexibility" or "configurability" that wasn't requested. Don't add a config option, feature flag, or extensibility hook because it seems like good practice — add it because the task asked for it.
No error handling for impossible scenarios. Handle the failure modes that are real for this system (expired OAuth token, Gmail rate limit, LLM timeout) — not hypothetical ones that can't occur given the actual call graph.
If you write 200 lines and it could be 50, rewrite it before committing.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, cut it down before it's reviewed, not after.

### 3. Surgical Changes

Touch only what you must. Clean up only your own mess.

When editing existing code:

Do not "improve" adjacent code, comments, or formatting that isn't part of the task.
Do not refactor working code that isn't broken, even if you'd structure it differently.
Match the existing style of the file you're editing, even if you disagree with it.
If you notice unrelated dead code, duplicate state, or a stub while working — mention it in your report, do not silently delete or fix it unless it's directly in the path of the current task (see §0 for what counts as "directly in the path").

When your own changes create orphans:

Remove imports/variables/functions that your edit made unused.
Do not remove pre-existing dead code, unused exports, or old fallback paths unless explicitly asked to.

Test: every changed line in your diff should trace directly to the user's request. If you can't explain why a specific line changed by pointing to the request, revert it.

### 4. Goal-Driven Execution

Define success criteria. Loop until verified. Don't stop at "looks right."

Transform every task into a verifiable goal before writing code:

"Add validation" → write a test for invalid input, confirm it fails, then make it pass.
"Fix the bug" → write/run a reproduction of the bug first, confirm you can trigger it, then confirm your fix removes it.
"Wire X to Y" → identify the exact observable end state (a row in a table, a redirect URL, a UI toast, a non-zero stat) and confirm that state exists after your change — don't infer it from the code looking correct.
"Refactor X" → confirm tests pass before your change and after; if no tests exist, say so before proceeding, since "no regression" can't be claimed without a baseline.

For any multi-step task, state a brief plan before starting, in this shape:

1. [Step] → verify: [specific check]
2. [Step] → verify: [specific check]
3. [Step] → verify: [specific check]

Weak success criteria ("make it work," "should be fine now") are not acceptable and require you to ask for a sharper definition of done before proceeding. Strong criteria are what let you work independently without checking in every step — vague criteria are what caused past failures here (a "Generate Drafts" button that looked wired but was a stub; an OAuth callback that "worked" but never redirected).

Signal this is working: fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions arriving before implementation rather than corrections arriving after a wrong result ships.

### 5. What this product actually is

CraftMyFunnel is an outreach automation platform (Apollo.io-style). The core loop is:

lead → assigned channel (Gmail live; LinkedIn/WhatsApp/Human = Phase 2, disabled in UI) → AI-generated draft (via stored provider key) → human approval → send → track reply/bounce/outcome

There is exactly one source of truth for each of the following. Never create a second:

Concept	Source of truth
Channel connection status	shared channels status object (email/linkedin/whatsapp/human)
Gmail mailbox record	single connectedMailbox row (used by Settings AND onboarding)
Campaign/lead pipeline state	single Campaign entity (Dashboard tracker reads this, does not maintain its own state)
AI provider + key	one config value, provider-agnostic (gemini/openai/anthropic)

If you find a second copy of any of the above while working, stop and report it — do not silently write to both to "keep them in sync." Consolidate or ask.

---

### 0. Hard rules (never violate these)
No silent stubs. A button/endpoint that appears functional in the UI must either do the real thing or visibly fail. Never leave a handler that looks wired but does nothing or returns fake success.
No hardcoded zeros or fake stats. Any dashboard number must come from a real query scoped to the current user/workspace. If the underlying data model for a stat doesn't exist yet, say so explicitly — do not wire it to something arbitrary just to show a number.
OAuth callbacks that are hit via browser top-level navigation must end in a redirect (302) back into the app, never a raw JSON response. JSON responses are only for fetch/XHR-invoked endpoints.
Every external API call (LLM, Gmail, any third-party) must have:
an explicit timeout
a capped retry count (never unbounded/open-ended retry loops)
a circuit breaker: N consecutive failures → flag for human review, stop retrying
a logged cost/usage estimate if it's a paid API call
Never invent a data model on the fly to satisfy a UI element. If a stat, status, or field doesn't have a backing table/column, say so and propose the schema — don't fabricate a plausible-looking number or state.
Migrations must be additive/reversible. When consolidating duplicate state (e.g. two mailbox records), use expand-and-contract: read from both, write to one, backfill, verify, then remove the old path. Never delete data before confirming the new path has it.
Every write path must be scoped per-workspace/per-user. No global counts, no cross-tenant leakage.

**This last rule — tenant scoping — gets re-verified explicitly, every time, not assumed from an earlier session.** Any task that touches RBAC, permissions, dashboard queries, or aggregate stats must include, in the report, at least one concrete example: paste the actual Prisma query for the lead/draft/campaign fetch involved and point at the `workspaceId`/`teamId` clause in it. "Already handled" without pointing at the actual query is not sufficient — this exact question was raised in the very first audit of this project and went unanswered for the entire subsequent engagement; it does not get to happen again.

### 2. Before writing any code

For every task, state back in 2-4 lines:

Which file(s)/route(s) you believe are involved (from actual search, not assumption)
Whether this touches any of the "single source of truth" items in §5 above — if yes, confirm you're extending the existing one, not creating a parallel one
What the acceptance test will be (a concrete user action → concrete observable result)
Whether this task introduces any new feature/subsystem not explicitly requested (per §3, Scope Control) — if yes, stop and ask before proceeding

Do not start editing until this is stated.

### 3. Verification — required before any commit

Run, in order, and paste the actual, full output (per §0 and §1 above — no committing while a task result is still pending):

node scripts/check-web-prisma-imports.mjs
npm run typecheck --workspace apps/web

Both must pass with 0 errors. If either fails, fix it — do not commit with a known typecheck/import failure and a note to "fix later."

After pushing, state explicitly:

Branch pushed to
Whether it's merged/deployed to the live site, or still sitting on a branch (these are different states — never imply "done" if it's only on a branch)
Whether the CI workflow has actually been observed completing on this specific commit (link/log), or only run locally (per §0.D)

### 4. Reporting back — required format

At the end of any task, report:

What changed (file-by-file, one line each)
What you verified yourself (ran the flow, confirmed X in the DB, etc.) vs. what still needs manual testing by the human — tagged per the four evidence tiers in §0.A
Any duplicate state, stub, or hardcoded value you found but did NOT fix (out of scope for this task) — flag it, don't fix it silently and don't ignore it
Any ambiguous requirement you resolved by guessing — call it out explicitly (e.g. "Signal Capture" metric — flag if you invented its definition instead of confirming it)
The Open-Items Ledger reconciliation (per §2 above) — every prior open item marked Resolved/Still Open/Deferred, every time, regardless of whether this task touched it directly

Never report a task as fully complete if any part of it was stubbed, mocked, or deferred. Partial completion must be labeled partial. Never assign a numeric score or percentage to overall readiness (per §0.B).

### 5. Known fragile areas (as of this file's last update)
Gmail OAuth: was returning raw JSON instead of redirecting — fixed once, re-verify after any change near apps/web/src/app/api/integrations/google/oauth/
Mailbox record duplication: Settings vs onboarding previously wrote separate rows — confirm still consolidated before touching either UI
Draft generation: previously a stub with a saved-but-unused Gemini key — confirm the real call path in campaign-execution-worker.ts before assuming it's wired
Dashboard stat cards (Meetings Secured, Active Pipeline, Drafts Queued, Signal Capture): confirm which are live-queried vs still hardcoded before claiming any dashboard work is "done"
Multi-tenant data isolation: never directly confirmed with a pasted query example (raised in the first-ever audit of this project) — treat as open until §0-Hard-Rules re-verification above is actually done, not assumed
Reply detection (Message-ID matching): architecture corrected to fetch the real wire header post-send, but "Gmail overwrites custom Message-ID headers" is a documented real-world failure mode elsewhere — re-confirm with a live send→reply cycle before trusting this fully closed
Google OAuth CASA assessment / Azure AD app registration for Microsoft OAuth: both are external, human-only actions (portal access required) — code-side "done" never means these are done; check status with the human directly, don't infer from code

### 6. Update this file

If you fix a bug, consolidate a duplicate, or wire a stub, add or update the relevant line in §5 so the next session doesn't re-discover the same issue from scratch. If you close an item from `OPEN_ITEMS.md`, remove it from §5 too so the two don't drift apart.