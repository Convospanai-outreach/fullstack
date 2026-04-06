"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import OnboardingChecklist from "@/modules/onboarding/ui/OnboardingChecklist";
import { Omnibox } from "@/components/dashboard/Omnibox";
import { ConnectionStatusBar } from "@/components/system/ConnectionStatusBar";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [showSetupBanner, setShowSetupBanner] = useState(false);
    const [setupPercent, setSetupPercent] = useState(0);

    useEffect(() => {
        // Only check setup status once on dashboard load
        fetch(process.env['NEXT_PUBLIC_API_URL'] + "/setup/status")
            .then(res => res.ok ? res.json() : null)
            .then(data => {
                if (data && (!data.readyToLaunch || data.completionPercent < 100)) {
                    setShowSetupBanner(true);
                    setSetupPercent(data.completionPercent || 0);
                }
            })
            .catch(console.error);
    }, []);

    return (
        <div className="flex min-h-screen bg-surface-app text-foreground selection:bg-brand-500/30">
            {/* Sidebar */}
            <DashboardSidebar
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
            />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-h-screen relative lg:pl-64">
                
                {/* Setup Wizard Banner — sits above the header */}
                {showSetupBanner && (
                    <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-4 py-3 flex items-center justify-between z-50 fixed top-0 left-0 right-0 h-12">
                        <div className="flex items-center space-x-4">
                            <span className="font-medium text-sm">Workspace setup is still in progress. Finish the required steps before launching campaigns. ({setupPercent}% complete)</span>
                        </div>
                        <Link href="/setup" className="px-4 py-1.5 bg-white/20 hover:bg-white/30 rounded text-sm font-semibold transition-colors shrink-0">
                            Open Setup
                        </Link>
                    </div>
                )}

                <DashboardHeader
                    onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                    bannerOffset={showSetupBanner}
                />

                {/* mt = header(64px) + optional banner(48px) */}
                <main className={`flex-1 ${showSetupBanner ? 'mt-[112px]' : 'mt-16'} p-4 lg:p-8 overflow-y-auto z-10 transition-all duration-300`}>
                    {/* Background Gradients */}
                    <div className="fixed inset-0 z-0 pointer-events-none opacity-20">
                        <div className="absolute top-[10%] right-[10%] w-[400px] h-[400px] bg-brand-900/10 rounded-full blur-[100px]" />
                        <div className="absolute bottom-[10%] left-[20%] w-[300px] h-[300px] bg-slate-800/10 rounded-full blur-[100px]" />
                    </div>

                    <div className="relative z-10">
                        {children}
                    </div>
                </main>
                <OnboardingChecklist />
            </div>
            <Omnibox />
            <ConnectionStatusBar />
        </div>
    );
}

