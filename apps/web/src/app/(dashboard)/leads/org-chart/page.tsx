"use client";

import { useSearchParams } from "next/navigation";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import OrgChart from "@/modules/analytics/components/OrgChart";

export default function OrgChartPage() {
    const searchParams = useSearchParams();
    const domain = searchParams.get("domain");
    const company = searchParams.get("company");

    if (!domain && !company) {
        return (
            <div className="p-6">
                <GlassCard>
                    <p className="text-white/60 text-sm">
                        Open this page from a lead's "View Org Chart" button - it needs a domain or
                        company to know which account to map.
                    </p>
                </GlassCard>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <SectionHeader
                title="Account Org Chart"
                subtitle={domain || company || ""}
            />
            <GlassCard>
                <p className="text-xs text-white/50 mb-4">
                    Drag between nodes to draw a reporting line. Built on demand for this account only.
                </p>
                <OrgChart domain={domain} company={company} />
            </GlassCard>
        </div>
    );
}
