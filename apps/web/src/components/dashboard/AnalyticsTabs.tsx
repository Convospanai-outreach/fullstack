"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
    { href: "/analytics/roi", label: "Campaign ROI" },
    { href: "/analytics/journey", label: "Lead journey funnel" },
    { href: "/analytics/ai", label: "AI fleet performance" },
] as const;

export function AnalyticsTabs() {
    const pathname = usePathname();

    return (
        <div className="glass inline-flex flex-wrap gap-[3px] rounded-[3px] p-[3px]">
            {TABS.map((tab) => {
                const isActive = pathname === tab.href;
                return (
                    <Link
                        key={tab.href}
                        href={tab.href}
                        aria-current={isActive ? "page" : undefined}
                        className={`px-3.5 py-[7px] text-[13px] leading-[1.3] transition-colors ${
                            isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        {tab.label}
                    </Link>
                );
            })}
        </div>
    );
}
