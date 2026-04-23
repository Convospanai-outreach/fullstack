"use client";

import { usePathname } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const DASHBOARD_PREFIXES = [
    "/dashboard", "/campaigns", "/workflows", "/leads", "/inbox",
    "/templates", "/pipeline", "/playbooks", "/knowledge", "/marketplace",
    "/approvals", "/billing", "/settings", "/agents", "/command-center",
    "/icp-builder", "/studio", "/team", "/caller", "/crm", "/landing-agent",
    "/governance", "/analytics", "/admin",
];

const MARKETING_PREFIXES = [
    "/", "/about", "/pricing", "/contact",
    "/login", "/signup", "/forgot-password", "/magic-link",
    "/verify-email", "/privacy", "/terms", "/p",
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
