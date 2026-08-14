# Accessibility Audit: /intel, /scraper-bridge, /jobs

**Date:** 2026-08-07
**Method:** Automated audit via axe-core 4.13.0, run against a live authenticated session (Playwright + Chromium) for each route. This is the standard automated proxy for WCAG 2 AA conformance — it does not replace manual screen-reader testing, but catches the large majority of structural and contrast issues a screen reader would surface.

## Results

### /intel — 2 violations
| Rule | Impact | Description |
|---|---|---|
| `landmark-one-main` | moderate | Document has no `<main>` landmark |
| `region` | moderate | Page content (`.sr-only`, `h1`, `.text-gray-400`, etc.) not contained by a landmark |

### /scraper-bridge — 5 violations (1 fixed during this audit)
| Rule | Impact | Description | Status |
|---|---|---|---|
| `select-name` | critical | `<select>` (Target field) had no accessible name — label wasn't associated via `htmlFor`/`id` | **Fixed** — `src/modules/scraper-bridge/ui/components/ScrapeForm.tsx` |
| `color-contrast` | serious | 5 elements (form labels, select) below WCAG AA contrast ratio | Open |
| `landmark-main-is-top-level` | moderate | `<main>` nested inside another landmark (`#main-content > main`) | **Fixed 2026-08-15** |
| `landmark-no-duplicate-main` | moderate | More than one `main` landmark on the page | **Fixed 2026-08-15** |
| `landmark-unique` | moderate | Duplicate landmarks without distinguishing role/label | **Fixed 2026-08-15** (same root cause) |

### /jobs — 1 violation
| Rule | Impact | Description |
|---|---|---|
| `color-contrast` | serious | `#type` and `#status` filter controls below WCAG AA contrast ratio |

## Disposition

The `select-name` critical violation on `/scraper-bridge` was fixed directly (one-line `htmlFor`/`id` association — no design or layout risk).

The remaining violations were left as findings rather than fixed directly:
- **Color-contrast** fixes require a specific replacement color that meets AA ratio against each background — a design decision, not picked here.
- The `/intel` `landmark-one-main`/`region` findings were not touched this pass — see caveat below.

**2026-08-15 (scraper-bridge landmark structure fixed):** Root-caused via static code reading, not a live re-run (production DB was down at the time — see `OPEN_ITEMS.md`). `apps/web/src/app/layout.tsx` wraps the entire app in `LayoutShell`, which unconditionally renders `<main id="main-content">` around every route's `children` regardless of path. `ScraperPage.tsx` additionally rendered its own top-level `<main>` inside that, producing exactly the nested/duplicate landmark axe-core flagged (`#main-content > main`). Fixed by changing `ScraperPage.tsx`'s wrapper from `<main>` to `<div>` — the site-wide `<main id="main-content">` from `LayoutShell` is the correct single landmark. This also implicitly resolves `landmark-unique` (same duplicate-main root cause). Verified via `tsc --noEmit`, full `apps/web` test suite (153 passing), lint (clean), and a real `next build` (`/scraper-bridge` compiles) — **not** re-verified with a live axe-core run (blocked on the same DB outage).

**Caveat, found while investigating — not fixed, flagged instead:** grepping the codebase turned up 41 other files still rendering their own `<main>` element, several of which (e.g. `apps/web/src/app/(dashboard)/layout.tsx`) also sit inside `LayoutShell`'s global `<main id="main-content">` — meaning this same nested-main pattern is likely far more widespread than the two routes this audit originally covered, `/intel` included. Did not fix these: with the app currently down (no live session to render and visually check each route against), blindly changing 41 files' landmark structure risks silently breaking layout or introducing new violations with no way to verify. This needs either a fresh axe-core pass once the app is back up, or a deliberate LayoutShell redesign (e.g. don't render `<main>` at the root at all, and require each route's own layout to own the single landmark) — a design decision, not something to pick unilaterally mid-fix.

Raw axe-core output (rule IDs, affected node counts, and CSS target selectors) is preserved above; re-running the audit script pattern (login → set `convo-hidden-features` cookie for gated routes → inject axe-core → `axe.run()`) will reproduce/confirm these results once the app is reachable again.
