"use client";

import { usePathname } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const DASHBOARD_PREFIXES = [
    "/dashboard", "/campaigns", "/workflows", "/leads", "/inbox",
    "/templates", "/pipeline", "/playbooks", "/knowledge", "/marketplace",
    "/approvals", "/billing", "/settings", "/agents", "/command-center",
    "/icp-builder", "/studio", "/team", "/caller", "/crm", "/landing-agent",
    "/governance", "/analytics", "/admin", "/intel", "/audit-logs",
    "/automations", "/calendar", "/jobs", "/monitoring", "/notifications",
    "/profile"
    // NOTE: "/security" intentionally excluded — src/app/security/page.tsx is a
    // top-level public page (not inside the (dashboard) route group), so it needs
    // LayoutShell's generic Header/Footer fallback, not the dashboard chrome.
    // "/setup", "/scraper-bridge", "/onboarding" excluded for the same reason —
    // none of them are inside the (dashboard) route group.
];

// Only routes actually rendered inside src/app/(marketing)/layout.tsx belong here —
// that layout supplies its own NavBar/Footer, so LayoutShell must not duplicate them.
// Top-level pages like /about, /pricing, /contact, /privacy, /terms are NOT in that
// route group and rely on LayoutShell's generic Header/Footer fallback below.
const MARKETING_PREFIXES = [
    "/", "/login", "/signup", "/forgot-password", "/magic-link",
    "/verify-email", "/p", "/funnel",
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

    return (
        <>
            {showHeader && <Header />}
            <main id="main-content" className="flex-1 focus:outline-none">{children}</main>
            {showFooter && <Footer />}
        </>
    );
}
