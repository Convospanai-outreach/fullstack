# Handoff: CraftMyFunnel Unified Dashboard

## Overview
A redesign of the CraftMyFunnel dashboard that consolidates 3 competing shells (the new `DashboardSidebar`/`DashboardHeader`, the legacy `AppShell`, and `GovernanceLayout`'s own tab nav) into ONE shell, ONE shared component kit (page header, glass card, badge, table row, empty state), a simplified task-first sidebar, a single searchable "Tools" hub for the long tail of flagged/beta features, and a global ⌘K command palette.

## About the Design File
The file in this bundle — `CraftMyFunnel Unified Dashboard.dc.html` — is a **design reference**, not production code to copy directly. It's a self-contained interactive HTML prototype (uses a small template runtime + a `Component` class holding state/render logic — not React/Next.js source). Treat it the way you'd treat a Figma prototype: recreate the layout, styling, and interaction model **inside the existing Next.js app** (`apps/web`, App Router, Tailwind v4, shadcn/radix, Clerk auth) using its real data (Prisma models, `/api/*` routes) instead of the prototype's hardcoded sample arrays.

## Fidelity
**High-fidelity.** Colors, spacing, typography, radii, and interaction states are final. Implement pixel-close using the values in "Design Tokens" below, adapted to Tailwind v4 config (`apps/web/src/app/globals.css`, `tailwind.config.js`) rather than the prototype's inline styles.

## What this replaces (real repo files)
| New unified screen | Existing repo source to replace/merge |
|---|---|
| Shell (sidebar + header) | `app/(dashboard)/layout.tsx`, `components/dashboard/DashboardSidebar.tsx`, `DashboardHeader.tsx` — **retire** `components/layout/AppShell.tsx` and `GovernanceLayout.tsx`'s custom header; every dashboard page should mount under the one shell |
| Overview | `app/(dashboard)/dashboard/page.tsx` + `KPIRow.tsx`, `WorkflowSection.tsx`, `BottomGrid.tsx` — kept, restyled; added a compact "Outreach input / Pipeline output" band using the stage set from `app/(dashboard)/pipeline/page.tsx` and revenue framing from `app/(dashboard)/analytics/roi/page.tsx` |
| Find leads | `app/(dashboard)/leads/page.tsx` — converted to a table; added a Netjana intent/temperature badge per row (`Lead.intentScore`, `webhooks/netjana-intel` HMAC signal) |
| Send outreach | `app/(dashboard)/campaigns/page.tsx` — converted to a table; added channel + A/B variant columns (`campaignService.ts`) |
| Track replies | New — `Inbox`/`ThreadList.tsx` pattern, simplified to a reply list |
| Buyer signals | `app/(dashboard)/intel/page.tsx` (Netjana Intel Dashboard) |
| Governance & trust | `app/(dashboard)/governance/page.tsx` + `GovernanceLayout.tsx` (tabs retired in favor of the one shell) |
| Billing & credits | `app/(dashboard)/billing/page.tsx` |
| CRM sync | `app/(dashboard)/crm/page.tsx` |
| Tools hub (new) | Consolidates the ~19 flagged/extra features from `lib/productFlags.ts` (`HIDDEN_FEATURES`) plus `icp-builder`, `templates`, `team` pages — one searchable, categorized grid instead of scattered nav entries |
| Command palette (new) | No existing equivalent — new ⌘K overlay, see Interactions below |

## Layout
- Sidebar: fixed 236px, flat list (Overview, Find leads, Send outreach, Track replies), then labeled groups "Analyze" (Buyer signals, Governance & trust) and "Account" (Billing & credits, CRM sync), then a "Tools" link, then a visually distinct dashed "Admin console — Restricted" block, then user identity footer.
- Header: 60px, a full-width search/palette trigger button (⌘K), a "Manual mode" status pill, a Dark/Light segmented toggle.
- Main content: max-width 1180px centered, 44px page padding, 32px vertical gap between sections.
- Cards: 12px radius, 20px padding, glassmorphism (translucent bg + 20px backdrop-blur + inset top highlight + directional bottom-right shadow + subtle top-left diagonal gradient sheen).
- Tables: header row (10.5px uppercase faint labels) + rows separated by 1px hairline dividers (`rowDivider`, not full borders) — used for Leads, Campaigns, companies, policies, billing history, threads.

## Components
- **Page header**: eyebrow label (11px, uppercase, group-accent color: blue=Outreach, violet=Analyze, teal=Account, amber=Admin) → H1 (28px/500) → description (14px, muted).
- **Tip banner**: inline hint bar under the page header, colored border/bg matching the linked tool's group, "TIP" label + text + "Open X →" CTA that navigates and cross-sells a relevant Tools-hub feature.
- **Badge/status pill**: 10–11px, 500 weight, 99px radius, colored bg+text pair from the semantic palette (success/warning/danger/info) or group accent.
- **Toggle switch** (was used for beta flags — now all features are live, switches removed): n/a in final version.
- **Command palette**: fixed overlay, centered, 520px panel, single text input ("Jump to a page or tool…") filtering a merged list of the 9 core pages + all 19 tools; click or Enter navigates.
- **Tools hub card**: name (13.5px/500) + description (12px, muted), grouped under a colored category label (Outreach tools / Automation / Account tools / Admin tool), 3-column grid, search input filters live.

## Interactions & Behavior
- Sidebar nav / Tools hub cards / palette results all set one `activeScreen` state key and re-render the matching content block — implement as real route navigation (`next/link` + route segments) instead of client state in production.
- Header search button opens the command palette (`⌘K` semantics — bind an actual `keydown` listener for Cmd/Ctrl+K in production).
- Dark/Light toggle swaps a palette object (see tokens below) — map to Tailwind's `.dark` class strategy already in `globals.css`.
- Tip banner clicks navigate straight to the referenced tool's detail/feature screen.
- Feature/tool detail screens show name + description + a short "ships when wired into the app" note — replace with the real feature's UI once implemented, or link out to its existing page if already built (e.g., ICP builder, Templates, Team already have real pages).

## Design Tokens

### Typography
- Font: `-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif`
- Weights: 400 (default), 500 (emphasis) — no 600/700 anywhere, matching the existing codebase's own comment ("Do not use semibold/bold in dashboard components")
- Sizes: 10–11px (labels/eyebrows), 12–13.5px (body/table), 14px (descriptions), 22–32px (stat values/H1)

### Color — Dark theme
- Background: `oklch(13.5% 0.012 260)` · Panel: `oklch(16% 0.013 260)` · Card: `oklch(24% 0.016 260 / 0.55)` (translucent, blurred)
- Border: `rgba(255,255,255,0.09)` · Border strong: `rgba(255,255,255,0.2)` · Row divider: `rgba(255,255,255,0.055)`
- Text: `oklch(95% 0.002 260)` · Muted: `oklch(72% 0.012 260)` · Faint: `oklch(52% 0.012 260)`
- Accent blue (Outreach/primary): `oklch(66% 0.17 260)` · Violet (Analyze): `oklch(66% 0.17 305)` · Teal (Account): `oklch(66% 0.13 175)` · Amber (Admin): `oklch(73% 0.14 70)`
- Success: `oklch(70% 0.15 150)` · Danger: `oklch(65% 0.19 25)`
- Card background gradient overlay: `linear-gradient(160deg, rgba(255,255,255,0.05), rgba(255,255,255,0) 40%)` over the card color
- Ambient page glow: `radial-gradient(ellipse 60% 40% at 20% -5%, rgba(99,102,241,0.10), transparent 60%), radial-gradient(ellipse 50% 35% at 100% 10%, rgba(139,92,246,0.07), transparent 55%)`
- Overview brand funnel motif (decorative, behind content): `clip-path: polygon(0% 8%, 100% 30%, 100% 70%, 0% 92%)` with `linear-gradient(90deg, rgba(59,130,246,0.12), rgba(139,92,246,0.05))`, `z-index:-1` so it never sits above content

### Color — Light theme
- Background: `oklch(97.5% 0.004 260)` · Panel/Card: `rgba(255,255,255,0.8 / 0.7)`
- Border: `rgba(0,0,0,0.08)` · Text: `oklch(22% 0.01 260)` · Muted: `oklch(42% 0.012 260)`
- Same accent hues at lower lightness (~50–52%) for contrast on white

### Radius & shadow
- Card radius: 12px · Pills/badges: 99px (full) · Inputs/buttons: 7–9px
- Card shadow: `inset 0 1px 0 rgba(255,255,255,0.07), 0 1px 2px rgba(0,0,0,0.25), 0 3px 8px -4px rgba(0,0,0,0.3), 3px 5px 10px -3px rgba(0,0,0,0.35)` (bottom-right directional)

## State Management (map to real app state)
- `theme`: 'dark' | 'light'
- `activeScreen`: string key → replace with actual route/pathname
- `toolQuery`, `paletteQuery`, `paletteOpen`: local UI state, fine as-is (useState)
- Real data to wire: dashboard KPIs (`/api/dashboard/summary`), leads (`prisma.lead`), campaigns (`prisma.campaign`), intel summary (`/api/proxy/intel/summary`), governance stats, billing/usage (`/billing/*`), CRM integrations (`/settings/crm`)

## Assets
No external images/icons used — all visuals are CSS (gradients, shapes, dots). No Lucide icons in the new nav (deliberately text-led per this redesign's direction); the rest of the app still uses Lucide and can keep doing so elsewhere.

## Files in this bundle
- `CraftMyFunnel Unified Dashboard.dc.html` — the full interactive prototype (open directly in a browser)
