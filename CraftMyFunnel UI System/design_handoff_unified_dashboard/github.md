repo: Convospanai-outreach/fullstack
branch: main
path: apps/web

## Last sync
date: 2026-08-08T08:55:22Z

### Updated in this project
- Dug into real integrated features beyond page-level UI: Netjana buyer-signal webhook (apps/api/routes/webhooks/netjana-intel, HMAC-verified), Lead.intentScore field (prisma/schema.prisma), campaignService.ts (LinkedIn-channel sequencing + weighted A/B variants), crm.ts (HubSpot contact sync by email). Added Netjana intent/temperature signal to lead cards, channel+variant tags to campaign cards, and an HMAC-verification line to Governance — closing gaps where the earlier rebuild had generic placeholders instead of real integrated behavior.
- Read dashboard shell (layout.tsx, DashboardSidebar, DashboardHeader), globals.css/tokens, and dashboard pages (Leads, Campaigns, Governance, Billing, CRM, Intel, Approvals, ROI, Team, Pipeline) plus AppShell/GovernanceLayout/productFlags/KPIRow/WorkflowSection/BottomGrid.
- Diagnosed root cause of UI inconsistency: 3 competing shells coexist (new DashboardSidebar+Header, legacy AppShell w/ own Sidebar+Header, GovernanceLayout's own tab sub-nav) — pages never migrated after the sidebar redesign.
- Built `CraftMyFunnel Unified Dashboard.dc.html`: one consolidated shell + shared component kit (page header w/ group accent, glass card, badge, empty state) applied to Overview, Find Leads, Send Outreach, Buyer Signals, Governance & Trust, Billing & Credits, CRM Sync, Advanced/Beta, Admin — simplified task-first nav, dark/light toggle.
- Reworked Overview into a single compact input/output view grounded in real fields: KPI row (KPIRow.tsx), status rail (WorkflowSection.tsx's 4-step model), an "Outreach input" stat block, and a "Pipeline output" stage-distribution bar using the real stage set from `pipeline/page.tsx` (Cold/Warm/Hot/Coordinating/Meeting booked/Completed) + revenue framing from `analytics/roi/page.tsx` — replacing an earlier separate "Pipeline" nav tab per feedback.

## Screen map
| Project screen | Repo source |
|---|---|
| Overview | app/(dashboard)/dashboard/page.tsx, components/dashboard/KPIRow.tsx, WorkflowSection.tsx, BottomGrid.tsx, app/(dashboard)/pipeline/page.tsx (stage set), app/(dashboard)/analytics/roi/page.tsx (revenue framing), app/(dashboard)/approvals/page.tsx (pending approvals count) |
| Find leads | apps/web/src/app/(dashboard)/leads/page.tsx |
| Send outreach | apps/web/src/app/(dashboard)/campaigns/page.tsx |
| Buyer signals | apps/web/src/app/(dashboard)/intel/page.tsx |
| Governance & trust | apps/web/src/app/(dashboard)/governance/page.tsx, components/governance/GovernanceLayout.tsx |
| Billing & credits | apps/web/src/app/(dashboard)/billing/page.tsx |
| CRM sync | apps/web/src/app/(dashboard)/crm/page.tsx |
| Shell / nav | app/(dashboard)/layout.tsx, components/dashboard/DashboardSidebar.tsx, DashboardHeader.tsx, components/layout/AppShell.tsx, lib/productFlags.ts |
