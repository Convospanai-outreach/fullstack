# Accessibility Audit: /intel, /scraper-bridge, /jobs

**Date:** 2026-08-07 (Updated & Resolved 2026-08-18)
**Standard:** WCAG 2.2 Level AA / W3C ARIA Authoring Practices Guide (APG)
**Method:** Automated audit via axe-core 4.13.0 and static DOM architecture review, remediation against WCAG 2.2 AA contrast minimums (4.5:1 text, 3:1 non-text/UI components) and single top-level landmark specifications.

## Results & Resolutions

### /intel — 2 violations (All Resolved 2026-08-18)
| Rule | Impact | Description | Status |
|---|---|---|---|
| `landmark-one-main` | moderate | Document has no `<main>` landmark | **Fixed 2026-08-18** — Inherits top-level `<main id="main-content">` via `(dashboard)/layout.tsx` shell, verified single-landmark |
| `region` | moderate | Page content not contained by a landmark | **Fixed 2026-08-18** — Page structured with `<header>` and explicit `<section aria-labelledby="...">` landmarks, loading/error states wrapped with `role="status"` / `role="alert"` |

### /scraper-bridge — 5 violations (All Resolved 2026-08-18)
| Rule | Impact | Description | Status |
|---|---|---|---|
| `select-name` | critical | `<select>` (Target field) had no accessible name — label wasn't associated via `htmlFor`/`id` | **Fixed** — `src/modules/scraper-bridge/ui/components/ScrapeForm.tsx` |
| `color-contrast` | serious | Form labels, inputs, links, and status badges below WCAG AA contrast ratio | **Fixed 2026-08-18** — Replaced low-contrast colors with WCAG 2.2 AA compliant palette (`text-sky-700`, `text-emerald-700`, `text-red-700`, `border-gray-400`, `bg-card`) meeting >= 4.5:1 ratio |
| `landmark-main-is-top-level` | moderate | `<main>` nested inside another landmark (`#main-content > main`) | **Fixed 2026-08-15** — Replaced inner `<main>` with semantic `<div>` inside `LayoutShell` |
| `landmark-no-duplicate-main` | moderate | More than one `main` landmark on the page | **Fixed 2026-08-15** (same root cause) |
| `landmark-unique` | moderate | Duplicate landmarks without distinguishing role/label | **Fixed 2026-08-15** (same root cause) |

### /jobs — 1 violation (Resolved 2026-08-18)
| Rule | Impact | Description | Status |
|---|---|---|---|
| `color-contrast` | serious | `#type` and `#status` filter controls below WCAG AA contrast ratio | **Fixed 2026-08-18** — Updated control borders (`border-gray-400 dark:border-gray-600`), headers (`text-foreground`, `text-gray-700`), badges (`emerald-900`/`sky-900`/`red-900`), and links (`text-sky-700`/`dark:text-sky-400`) satisfying WCAG 1.4.3 & 1.4.11 |

## Disposition & Compliance Summary

1. **Landmark Architecture:** Global landmark topology enforces a single `<main id="main-content">` per route (via `LayoutShell` for marketing/public routes and `(dashboard)/layout.tsx` for dashboard routes), with child views utilizing semantic `<section aria-labelledby="...">` and `<article>` structures.
2. **Color Contrast:** All text, icon, and UI border elements meet or exceed WCAG 2.2 Level AA thresholds (4.5:1 for normal text, 3:1 for large text and interactive component boundaries).
3. **Form Accessibility:** All `<input>` and `<select>` elements feature programmatic `<label htmlFor="...">` bindings and explicit focus states (`focus:ring-2 focus:ring-primary`).

