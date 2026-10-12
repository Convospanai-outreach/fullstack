"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/GlassCard";
import { landingAgentApi } from "@/modules/landing-agent/service/landingAgentApi";
import type { LandingCampaignSummary } from "@/modules/landing-agent/types";

// Where a landing campaign picks up again: the editor once a page exists, else the step it stopped at.
export function nextStep(campaign: LandingCampaignSummary): { href: string; label: string; status: string } {
    const base = `/landing-agent/${encodeURIComponent(campaign.id)}`;
    const page = campaign.pages[0];
    if (page) {
        return { href: `${base}/editor`, label: "Edit", status: page.status === "published" ? "Published" : "Draft" };
    }
    if (campaign._count.wireframeOptions > 0) {
        return { href: `${base}/wireframes`, label: "Pick a layout", status: "Not built yet" };
    }
    return { href: `${base}/brief`, label: "Continue", status: "Not built yet" };
}

// A published page's public address: on the team's connected domain when there is one, else on the app.
export function liveUrl(slug: string, liveDomain?: string | null): string {
    const path = `/${encodeURIComponent(slug)}`;
    return liveDomain ? `https://${liveDomain}${path}` : `/p${path}`;
}

export default function LandingPageList() {
    const [campaigns, setCampaigns] = useState<LandingCampaignSummary[] | null>(null);
    const [liveDomain, setLiveDomain] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        landingAgentApi
            .listCampaigns()
            .then((data) => {
                setCampaigns(data.campaigns);
                setLiveDomain(data.liveDomain);
            })
            .catch((err: any) => setError(err?.message || "Failed to load landing pages"));
    }, []);

    return (
        <div className="p-6 lg:p-8 space-y-6">
            <GlassCard className="p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">Landing pages</h1>
                        <p className="mt-2 text-sm text-muted-foreground">Open a page to edit it, or start a new one.</p>
                    </div>
                    <Button asChild className="bg-cyan-600 hover:bg-cyan-500 text-white">
                        <Link href="/landing-agent/new">New landing page</Link>
                    </Button>
                </div>
            </GlassCard>

            {error ? <GlassCard className="p-8 text-destructive">{error}</GlassCard> : null}
            {!error && campaigns === null ? <GlassCard className="p-8 text-muted-foreground">Loading landing pages...</GlassCard> : null}
            {campaigns?.length === 0 ? <GlassCard className="p-8 text-muted-foreground">No landing pages yet.</GlassCard> : null}

            {campaigns && campaigns.length > 0 ? (
                <GlassCard className="p-0">
                    <ul className="divide-y divide-border">
                        {campaigns.map((campaign) => {
                            const page = campaign.pages[0];
                            const step = nextStep(campaign);
                            return (
                                <li key={campaign.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                                    <div className="min-w-0">
                                        <p className="truncate font-medium text-foreground">{page?.title || campaign.name}</p>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            {step.status} · {campaign._count.leads} sign-up{campaign._count.leads === 1 ? "" : "s"} · edited{" "}
                                            {new Date(page?.updatedAt || campaign.updatedAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {page?.status === "published" ? (
                                            <Button asChild variant="outline">
                                                <a href={liveUrl(page.slug, liveDomain)} target="_blank" rel="noopener noreferrer">
                                                    View live
                                                </a>
                                            </Button>
                                        ) : null}
                                        <Button asChild>
                                            <Link href={step.href}>{step.label}</Link>
                                        </Button>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </GlassCard>
            ) : null}
        </div>
    );
}
