"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TrendingUp, BarChart3, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";

const TABS = [
    { href: "/analytics/roi", label: "Campaign ROI", icon: TrendingUp },
    { href: "/analytics/journey", label: "Lead Journey Funnel", icon: BarChart3 },
    { href: "/analytics/ai", label: "AI Fleet Performance", icon: Cpu },
] as const;

export function AnalyticsTabs() {
    const pathname = usePathname();

    return (
        <div className="flex gap-2 flex-wrap">
            {TABS.map((tab) => {
                const isActive = pathname === tab.href;
                const Icon = tab.icon;
                return (
                    <Link key={tab.href} href={tab.href}>
                        <Button
                            variant={isActive ? "default" : "outline"}
                            className={isActive
                                ? "bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-500/25"
                                : "border-white/10 hover:bg-white/5"}
                        >
                            <Icon className={`w-4 h-4 mr-2 ${isActive ? "" : "text-violet-400"}`} />
                            {tab.label}
                        </Button>
                    </Link>
                );
            })}
        </div>
    );
}
