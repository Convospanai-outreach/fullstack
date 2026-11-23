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
                                ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25"
                                : "border-border hover:bg-accent"}
                        >
                            <Icon className={`w-4 h-4 mr-2 ${isActive ? "" : "text-primary"}`} />
                            {tab.label}
                        </Button>
                    </Link>
                );
            })}
        </div>
    );
}
