"use client";

import { useState } from "react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import OnboardingChecklist from "@/modules/onboarding/ui/OnboardingChecklist";
import { Omnibox } from "@/components/dashboard/Omnibox";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="flex min-h-screen bg-surface-app text-foreground selection:bg-brand-500/30">
            {/* Sidebar */}
            <DashboardSidebar
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
            />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-h-screen relative lg:pl-64">
                <DashboardHeader
                    onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                />

                <main className="flex-1 mt-16 p-4 lg:p-8 overflow-y-auto z-10">
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
        </div>
    );
}
