"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { landingAgentApi } from "@/modules/landing-agent/service/landingAgentApi";
import { landingExperimentApi } from "@/modules/landing-agent/service/landingExperimentApi";
import { landingFunnelApi, type FunnelReportResponse } from "@/modules/landing-agent/service/landingFunnelApi";
import { dropOffText, durationText, presetRange } from "./landingFunnelCopy";

const PRESET_DAYS = [7, 30, 90] as const;

interface PageOption {
    id: string;
    label: string;
}

interface VariantOption {
    id: string;
    label: string;
}

// Where the landing pages go: stage counts, drop-off and median time between stages (phase 12).
// The API does the counting; this only shows it. Filters are page and A/B variant, over 7, 30 or 90 days.
export default function LandingFunnelReport() {
    const [days, setDays] = useState<(typeof PRESET_DAYS)[number]>(30);
    const [pageId, setPageId] = useState("");
    const [variantId, setVariantId] = useState("");
    const [pages, setPages] = useState<PageOption[]>([]);
    const [variants, setVariants] = useState<VariantOption[]>([]);
    const [report, setReport] = useState<FunnelReportResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        Promise.all([landingAgentApi.listCampaigns(), landingExperimentApi.list()])
            .then(([campaigns, experiments]) => {
                setPages(campaigns.campaigns.flatMap((c) => c.pages.map((p) => ({ id: p.id, label: p.title ?? p.slug }))));
                setVariants(experiments.flatMap((e) => e.variants.map((v) => ({ id: v.id, label: `${e.name}: ${v.name}` }))));
            })
            .catch(() => setError("Could not load pages and tests for the filters"));
    }, []);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        landingFunnelApi
            .get({ ...presetRange(days, new Date()), landingPageId: pageId || undefined, variantId: variantId || undefined })
            .then((next) => {
                if (cancelled) return;
                setReport(next);
                setError(null);
            })
            .catch((e) => {
                if (cancelled) return;
                setError(e instanceof Error ? e.message : "Could not load the funnel report");
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [days, pageId, variantId]);

    const hasVisits = report !== null && (report.steps[0]?.count ?? 0) > 0;

    return (
        <GlassCard className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-text-primary">Funnel report</h2>
                    <p className="text-sm text-muted-foreground">From the first visit to a won deal, for the chosen dates.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {PRESET_DAYS.map((preset) => (
                        <button
                            key={preset}
                            type="button"
                            aria-pressed={days === preset}
                            onClick={() => setDays(preset)}
                            className="rounded-md border px-3 py-1 text-sm"
                        >
                            Last {preset} days
                        </button>
                    ))}
                    <select aria-label="Page" value={pageId} onChange={(e) => setPageId(e.target.value)} className="rounded-md border px-2 py-1 text-sm">
                        <option value="">All pages</option>
                        {pages.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.label}
                            </option>
                        ))}
                    </select>
                    <select aria-label="Variant" value={variantId} onChange={(e) => setVariantId(e.target.value)} className="rounded-md border px-2 py-1 text-sm">
                        <option value="">All variants</option>
                        {variants.map((v) => (
                            <option key={v.id} value={v.id}>
                                {v.label}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}
            {loading && !report && <p className="text-sm text-muted-foreground">Loading the report...</p>}

            {report && !hasVisits && <p className="text-sm text-muted-foreground">No visits in this range yet.</p>}

            {report && hasVisits && (
                <>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="text-muted-foreground">
                                    <th className="py-2 pr-4 font-medium">Step</th>
                                    <th className="py-2 pr-4 font-medium">Count</th>
                                    <th className="py-2 pr-4 font-medium">Drop-off from previous</th>
                                    <th className="py-2 pr-4 font-medium">Median time from previous</th>
                                </tr>
                            </thead>
                            <tbody>
                                {report.steps.map((step) => (
                                    <tr key={step.key} className="border-t border-white/10">
                                        <td className="py-2 pr-4">{step.label}</td>
                                        <td className="py-2 pr-4">{step.count.toLocaleString()}</td>
                                        <td className="py-2 pr-4">{dropOffText(step.dropOffPercent)}</td>
                                        <td className="py-2 pr-4">{durationText(step.medianSecondsFromPrevious)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                        <li>CTA anchor clicks: {report.sideMetrics.ctaClicks.toLocaleString()}</li>
                        <li>
                            Qualified (HOT): {report.sideMetrics.qualified.toLocaleString()}, median {durationText(report.sideMetrics.medianSecondsLeadToQualified)} after the lead
                        </li>
                        {report.instagram && <li>Instagram keyword replies sent (all pages, this range): {report.instagram.repliesSent.toLocaleString()}</li>}
                    </ul>
                    <p className="text-xs text-muted-foreground">
                        A step can be larger than the one before it when a lead came in without a tracked visit; the drop-off then shows as a gain.
                    </p>
                </>
            )}
        </GlassCard>
    );
}
