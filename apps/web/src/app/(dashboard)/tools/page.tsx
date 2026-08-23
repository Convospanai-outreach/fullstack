"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, ExternalLink, Lock } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { HIDDEN_FEATURES, type HiddenFeatureKey } from "@/lib/productFlags";

type Category = "Outreach" | "Automation" | "Account" | "Admin";

const CATEGORY_BY_KEY: Record<HiddenFeatureKey, Category> = {
    "playbooks": "Outreach",
    "hunter-email-finder": "Outreach",
    "csv-ingestion": "Outreach",
    "linkedin-runner": "Outreach",
    "caller": "Outreach",
    "whatsapp": "Outreach",
    "studio": "Outreach",
    "workflows": "Automation",
    "agents": "Automation",
    "jobs": "Automation",
    "knowledge": "Automation",
    "command-center": "Automation",
    "runtime": "Automation",
    "marketplace": "Account",
    "scraper-bridge": "Admin",
    "edge": "Admin",
    "sovereign": "Admin",
};

const CATEGORY_ORDER: Category[] = ["Outreach", "Automation", "Account", "Admin"];

export default function ToolsHubPage() {
    const [query, setQuery] = useState("");

    const categories = useMemo(() => {
        const q = query.trim().toLowerCase();
        const matches = (label: string, description: string) =>
            !q || label.toLowerCase().includes(q) || description.toLowerCase().includes(q);

        return CATEGORY_ORDER
            .map((category) => ({
                category,
                items: Object.values(HIDDEN_FEATURES)
                    .filter((f) => CATEGORY_BY_KEY[f.key] === category)
                    .filter((f) => matches(f.label, f.description)),
            }))
            .filter((group) => group.items.length > 0);
    }, [query]);

    const isEmpty = categories.length === 0;

    return (
        <div className="space-y-6">
            <SectionHeader
                title="Tools"
                subtitle="Every feature surface in one searchable place — jump straight to what you need."
            />

            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search tools…"
                    className="w-full pl-9 pr-3 h-9 rounded-md text-sm bg-white/4 border border-white/7 text-white/80 placeholder:text-white/25 focus:outline-none focus:border-blue-500/40"
                />
            </div>

            {isEmpty ? (
                <GlassCard className="p-8 text-center text-sm text-white/40">
                    No tools match "{query}".
                </GlassCard>
            ) : (
                categories.map(({ category, items }) => (
                    <div key={category} className="space-y-3">
                        <span className="text-[11px] uppercase tracking-wide font-medium text-white/30">
                            {category}
                        </span>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {items.map((feature) => {
                                const disabled = !feature.built;
                                const card = (
                                    <GlassCard
                                        className={`p-4 h-full transition-colors ${
                                            disabled ? "opacity-50 cursor-not-allowed" : "hover:border-white/20"
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <span className="text-[13.5px] font-medium text-white/90">
                                                {feature.label}
                                            </span>
                                            {disabled ? (
                                                <Lock className="w-3.5 h-3.5 text-white/25 flex-shrink-0 mt-0.5" />
                                            ) : (
                                                <ExternalLink className="w-3.5 h-3.5 text-white/25 flex-shrink-0 mt-0.5" />
                                            )}
                                        </div>
                                        <p className="mt-1 text-xs text-white/40 leading-relaxed">
                                            {feature.description}
                                        </p>
                                    </GlassCard>
                                );

                                return disabled ? (
                                    <div key={feature.key}>{card}</div>
                                ) : (
                                    <Link key={feature.key} href={feature.openPath}>
                                        {card}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                ))
            )}
        </div>
    );
}
