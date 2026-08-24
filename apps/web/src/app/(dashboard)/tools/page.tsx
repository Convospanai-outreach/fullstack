"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Search, ExternalLink, EyeOff } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import {
    HIDDEN_FEATURE_CATEGORY_BY_KEY,
    HIDDEN_FEATURE_CATEGORY_ORDER,
    type HiddenFeatureCategory,
    type HiddenFeatureKey,
} from "@/lib/productFlags";

type ToolStatus = {
    key: HiddenFeatureKey;
    label: string;
    description: string;
    openPath: string;
    built: boolean;
    enabled: boolean;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function ToolsHubPage() {
    const [query, setQuery] = useState("");
    const { data } = useSWR<{ features: ToolStatus[] }>("/api/settings/hidden-features", fetcher);
    const tools = data?.features ?? null;

    const categories = useMemo(() => {
        if (!tools) return [];
        const q = query.trim().toLowerCase();
        const matches = (label: string, description: string) =>
            !q || label.toLowerCase().includes(q) || description.toLowerCase().includes(q);

        return HIDDEN_FEATURE_CATEGORY_ORDER
            .map((category: HiddenFeatureCategory) => ({
                category,
                items: tools
                    .filter((f) => HIDDEN_FEATURE_CATEGORY_BY_KEY[f.key] === category)
                    .filter((f) => matches(f.label, f.description)),
            }))
            .filter((group) => group.items.length > 0);
    }, [tools, query]);

    const isLoading = tools === null;
    const isEmpty = !isLoading && categories.length === 0;

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

            {isLoading ? (
                <GlassCard className="p-8 text-center text-sm text-white/40">Loading tools…</GlassCard>
            ) : isEmpty ? (
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
                                // "Live" only when both built and turned on for this workspace — a
                                // feature that's built but not enabled still redirects to the
                                // /settings/features toggle, so it must not look identically openable.
                                const isLive = feature.built && feature.enabled;
                                const href = isLive
                                    ? feature.openPath
                                    : `/settings/features?feature=${feature.key}`;

                                return (
                                    <Link key={feature.key} href={href}>
                                        <GlassCard className="p-4 h-full transition-colors hover:border-white/20">
                                            <div className="flex items-start justify-between gap-2">
                                                <span className="text-[13.5px] font-medium text-white/90">
                                                    {feature.label}
                                                </span>
                                                {isLive ? (
                                                    <ExternalLink className="w-3.5 h-3.5 text-white/25 flex-shrink-0 mt-0.5" />
                                                ) : (
                                                    <EyeOff className="w-3.5 h-3.5 text-amber-400/60 flex-shrink-0 mt-0.5" />
                                                )}
                                            </div>
                                            <p className="mt-1 text-xs text-white/40 leading-relaxed">
                                                {feature.description}
                                            </p>
                                            {!isLive && (
                                                <p className="mt-2 text-[10px] uppercase tracking-wide font-medium text-amber-400/70">
                                                    Hidden — tap to turn on
                                                </p>
                                            )}
                                        </GlassCard>
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
