"use client";

import { usePathname } from "next/navigation";
import { NavBar } from "@/components/NavBar";
import Footer from "@/components/Footer";

// Kept in sync with apps/web/src/app/(dashboard)/* by
// tests/unit/dashboard-prefixes.test.ts, which fails the build if a new
// top-level folder is added there without a matching entry here (this list
// previously drifted silently - /whatsapp, /edge, /sovereign, /runtime, and
// /command-center were missing and rendered with the wrong marketing chrome
// instead of the dashboard sidebar).
export const DASHBOARD_PREFIXES = [
    "/admin", "/agents", "/analytics", "/approvals", "/audit-logs",
    "/automations", "/billing", "/calendar", "/caller", "/campaigns",
    "/command-center", "/crm", "/dashboard", "/edge", "/governance",
    "/icp-builder", "/inbox", "/intel", "/jobs", "/knowledge",
    "/landing-agent", "/leads", "/marketplace", "/monitoring",
    "/notifications", "/pipeline", "/playbooks", "/profile", "/runtime",
    "/settings", "/sovereign", "/studio", "/team", "/templates", "/tools",
    "/whatsapp", "/workflows"
    // NOTE: "/security" intentionally excluded — src/app/security/page.tsx is a
    // top-level public page (not inside the (dashboard) route group), so it needs
    // LayoutShell's generic Header/Footer fallback, not the dashboard chrome.
    // "/setup", "/scraper-bridge", "/onboarding" excluded for the same reason —
    // none of them are inside the (dashboard) route group. ("/scraper-bridge",
    // "/hunter-email-finder", and "/csv-ingestion" are registered in productFlags.ts's
    // HIDDEN_FEATURES and do have real page directories today.)
];

// Only routes actually rendered inside src/app/(marketing)/layout.tsx belong here —
// that layout supplies its own NavBar/Footer, so LayoutShell must not duplicate them.
// Top-level pages like /about, /pricing, /contact, /privacy, /terms are NOT in that
// route group and rely on LayoutShell's generic Header/Footer fallback below.
const MARKETING_PREFIXES = [
    "/", "/login", "/signup", "/forgot-password", "/magic-link",
    "/verify-email", "/p", "/funnel", "/accept-invite", "/agent-login",
    "/client-login",
];

export function LayoutShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    const isDashboard = DASHBOARD_PREFIXES.some(
        (prefix) => pathname === prefix || pathname?.startsWith(`${prefix}/`)
    );
    const isMarketing = MARKETING_PREFIXES.some(
        (prefix) => pathname === prefix || pathname?.startsWith(`${prefix}/`)
    );

    // Dashboard has its own sidebar + header; Marketing layout has its own NavBar + Footer
    const showHeader = !isDashboard && !isMarketing;
    const showFooter = !isDashboard && !isMarketing;

    if (isDashboard) {
        // Dashboard layout owns its own <main id="main-content"> wrapper.
        // LayoutShell must not add a second <main> around the sidebar chrome.
        return <>{children}</>;
    }

    return (
        <>
            {showHeader && <NavBar />}
            <main id="main-content" className={`flex-1 focus:outline-none ${showHeader ? "pt-20" : ""}`}>{children}</main>
            {showFooter && <Footer />}
        </>
    );
}
