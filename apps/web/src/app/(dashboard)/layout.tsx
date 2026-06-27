"use client";

/*
 * app/(dashboard)/layout.tsx — Dashboard route group shell
 *
 * Changes from previous version:
 * - Removed: fixed full-bleed setup banner (moved inline to dashboard home page)
 * - Removed: showSetupBanner / setupPercent state (setup fetch moved to page.tsx)
 * - Removed: OnboardingChecklist (replaced by WorkflowSection in dashboard page)
 * - Removed: bannerOffset prop on DashboardHeader
 * - Updated: main content margin-top now fixed mt-12 (48px header, no banner offset)
 * - Updated: sidebar offset updated to lg:pl-48 (192px, matching new sidebar width)
 * - Kept: clerk-sync auth check, Omnibox, ConnectionStatusBar
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { Omnibox } from "@/components/dashboard/Omnibox";
import { ConnectionStatusBar } from "@/components/system/ConnectionStatusBar";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    useEffect(() => {
        let cancelled = false;

        // Auth gate: redirect to invite wall if user not authorized
        fetch("/api/auth/clerk-sync", { cache: "no-store" })
            .then((res) => {
                if (!cancelled && res.status === 403) {
                    router.replace("/login?invite=required");
                }
            })
            .catch(() => {});

        return () => {
            cancelled = true;
        };
    }, [router]);

    return (
        <div className="flex min-h-screen bg-surface-app text-foreground selection:bg-brand-500/30">
            {/* Sidebar — fixed, 192px wide on desktop */}
            <DashboardSidebar
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
            />

            {/* Main content area — offset by sidebar width on desktop */}
            <div className="flex-1 flex flex-col min-h-screen relative lg:pl-48">
                <DashboardHeader
                    onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                />

                {/* mt-12 = fixed header height (48px) */}
                <main className="flex-1 mt-12 p-4 lg:p-6 overflow-y-auto z-10">
                    {/* Subtle background gradients */}
                    <div className="fixed inset-0 z-0 pointer-events-none opacity-20">
                        <div className="absolute top-[10%] right-[10%] w-[400px] h-[400px] bg-brand-900/10 rounded-full blur-[100px]" />
                        <div className="absolute bottom-[10%] left-[20%] w-[300px] h-[300px] bg-slate-800/10 rounded-full blur-[100px]" />
                    </div>

                    <div className="relative z-10">
                        {children}
                    </div>
                </main>
            </div>

            {/* Global overlays */}
            <Omnibox />
            <ConnectionStatusBar />
        </div>
    );
}
