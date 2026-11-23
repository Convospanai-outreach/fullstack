"use client";

/*
 * app/(dashboard)/DashboardShell.tsx — Dashboard route group shell (client side;
 * layout.tsx wraps it so every dashboard route renders per request)
 *
 * Changes from previous version:
 * - Removed: fixed full-bleed setup banner (moved inline to dashboard home page)
 * - Removed: showSetupBanner / setupPercent state (setup fetch moved to page.tsx)
 * - Removed: OnboardingChecklist (replaced by WorkflowSection in dashboard page)
 * - Removed: bannerOffset prop on DashboardHeader
 * - Updated: main content margin-top now fixed mt-14 (56px header, no banner offset)
 * - Updated: sidebar offset updated to lg:pl-[232px] (matching the sidebar width)
 * - Kept: Omnibox, ConnectionStatusBar
 * - Added: SectionTabs above every page (the current sidebar section's pages as tabs)
 * - Removed: clerk-sync auth gate - proxy.ts's own session check (token-based,
 *   provider-agnostic) already covers unauthenticated access; the extra gate
 *   here only ever guarded a Clerk-specific async-webhook race.
 */

import { useState } from "react";
import { usePathname } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { Omnibox } from "@/components/dashboard/Omnibox";
import { SectionTabs } from "@/components/dashboard/SectionTabs";
import { SiteBanner } from "@/components/dashboard/SiteBanner";
import WelcomeTour from "@/components/onboarding/WelcomeTour";

export default function DashboardShell({
    children,
}: {
    children: React.ReactNode;
}) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    // Mockup page widths: 1120 (content 1024) by default, 1160 (content 1064) for Reports.
    const wide = usePathname()?.startsWith("/analytics");

    return (
        <div className="flex min-h-screen bg-background text-foreground selection:bg-primary/30 relative">
            {/* Abstract Glowing Wave Backdrop Pattern */}
            <div className="backdrop-wave-pattern" aria-hidden="true" />

            {/* Sidebar — fixed, 192px wide on desktop */}
            <DashboardSidebar
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
            />

            {/* Main content area — offset by sidebar width on desktop */}
            <div className="flex-1 min-w-0 flex flex-col min-h-screen relative lg:pl-[232px]">
                <DashboardHeader
                    onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                />

                {/* mt-12 = fixed header height (48px) */}
                <main id="main-content" className="flex-1 mt-[51px] p-4 lg:px-12 lg:pt-8 lg:pb-20 overflow-y-auto z-10" tabIndex={-1}>
                    <div className={`relative z-10 ${wide ? "lg:max-w-[1064px]" : "lg:max-w-[1024px]"}`}>
                        <SiteBanner />
                        <SectionTabs />
                        {children}
                    </div>
                </main>
            </div>

            {/* Global overlays */}
            <Omnibox />
            <WelcomeTour />
        </div>
    );
}
