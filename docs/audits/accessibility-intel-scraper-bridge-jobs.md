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
| `landmark-main-is-top-level` | moderate | `<main>` nested inside another landmark (`#main-content > main`) | Open |
| `landmark-no-duplicate-main` | moderate | More than one `main` landmark on the page | Open |
| `landmark-unique` | moderate | Duplicate landmarks without distinguishing role/label | Open |

### /jobs — 1 violation
| Rule | Impact | Description |
|---|---|---|
| `color-contrast` | serious | `#type` and `#status` filter controls below WCAG AA contrast ratio |

## Disposition

The `select-name` critical violation on `/scraper-bridge` was fixed directly (one-line `htmlFor`/`id` association — no design or layout risk).

The remaining violations were left as findings rather than fixed directly:
- **Color-contrast** fixes require a specific replacement color that meets AA ratio against each background — a design decision, not picked here.
- **Landmark structure** issues on `/scraper-bridge` (nested/duplicate `main`) and the missing `main` landmark on `/intel` touch shared layout composition and could affect other routes using the same wrapper components — worth a scoped follow-up rather than a same-pass fix.

Raw axe-core output (rule IDs, affected node counts, and CSS target selectors) is preserved above; re-running the audit script pattern (login → set `convo-hidden-features` cookie for gated routes → inject axe-core → `axe.run()`) will reproduce these results.
