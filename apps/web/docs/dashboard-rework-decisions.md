# Dashboard Rework — Design Decisions

## Architecture
- Eliminated LayoutShell from dashboard route group to remove shell-within-a-shell
- Dashboard layout is now fully self-contained (sidebar + header own the chrome)
- Also removed `AppShell` from the dashboard home page — it was rendering a second `Sidebar` + `Header` from `components/layout/`, creating a triple-layered shell

## Navigation
- Sidebar reduced from 288px to 192px (Linear/Vercel standard)
- Added workspace switcher between logo and nav (Vercel pattern)
- Identity consolidated to single row at sidebar footer
- Mode badge ("Manual mode") moved to header topbar for persistent visibility

## Dashboard home page
- Added KPI row above fold — answers "is everything OK?" in <2s (Stripe pattern)
- Workflow section uses progressive disclosure: progress rail + single active step
  detail card (Linear pattern)
- Setup banner moved from fixed layout overlay to inline page content
- EmptyState component added for activity feed and all data-dependent panels

## Typography
- Reduced to two font weights: 400 (normal) and 500 (medium)
- Removed font-semibold and font-bold from all dashboard components
- Color is semantic only: blue=active/accent, emerald=success/done, amber=warning

## API
- Added /api/dashboard/summary stub with TODO comments for Supabase wiring
- DashboardData interface defined in types — wire to real queries before launch

## What was intentionally left for later
- Sparklines inside KPI cards (Stripe/Baremetrics pattern) — needs chart library
- Workspace switcher modal (TODO comment in sidebar)
- OnboardingChecklist — moved out of layout; old component kept in repo (only used in layout, safe to delete later)
