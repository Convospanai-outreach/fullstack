import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import OnboardingChecklist from "@/modules/onboarding/ui/OnboardingChecklist";
import { Omnibox } from "@/components/dashboard/Omnibox";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-screen bg-black text-white selection:bg-blue-500/30">
            {/* Sidebar (Fixed) */}
            <DashboardSidebar />

            {/* Main Content Area */}
            <div className="flex-1 ml-64 flex flex-col min-h-screen relative">
                <DashboardHeader />

                <main className="flex-1 mt-16 p-8 overflow-y-auto z-10">
                    {/* Background Gradients for Dashboard Area */}
                    <div className="fixed inset-0 z-0 pointer-events-none opacity-50">
                        <div className="absolute top-[10%] right-[10%] w-[400px] h-[400px] bg-blue-900/10 rounded-full blur-[100px]" />
                        <div className="absolute bottom-[10%] left-[20%] w-[300px] h-[300px] bg-purple-900/10 rounded-full blur-[100px]" />
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
