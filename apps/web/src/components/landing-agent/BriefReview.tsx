"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/GlassCard";
import type { LandingCampaign } from "@/modules/landing-agent/types";
import { landingAgentApi } from "@/modules/landing-agent/service/landingAgentApi";

interface Props {
    campaign: LandingCampaign;
    onAdvance: () => void;
    onRefresh: () => Promise<void>;
}

export default function BriefReview({ campaign, onAdvance, onRefresh }: Props) {
    const [running, setRunning] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function generate() {
        setRunning(true);
        setError(null);
        try {
            await landingAgentApi.generateBrief(campaign.id, campaign.framework || undefined);
            await onRefresh();
        } catch (err: any) {
            setError(err?.message || "Failed to generate brief");
        } finally {
            setRunning(false);
        }
    }

    const hasBrief = Boolean(campaign.challenge || campaign.solution || campaign.benefit);

    return (
        <GlassCard className="p-8 space-y-6">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Step 1</p>
                    <h2 className="mt-2 text-2xl font-bold text-white">Structured Brief</h2>
                    <p className="mt-2 text-sm text-slate-300">Review challenge, solution, and benefit before wireframe generation.</p>
                </div>
                <Button onClick={generate} disabled={running} className="bg-cyan-600 hover:bg-cyan-500 text-white">
                    {running ? "Generating..." : hasBrief ? "Regenerate Brief" : "Generate Brief"}
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border border-white/10 bg-slate-900/50 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Challenge</p>
                    <p className="mt-2 text-sm text-slate-100">{campaign.challenge || "Not generated yet"}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-slate-900/50 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Solution</p>
                    <p className="mt-2 text-sm text-slate-100">{campaign.solution || "Not generated yet"}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-slate-900/50 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Benefit</p>
                    <p className="mt-2 text-sm text-slate-100">{campaign.benefit || "Not generated yet"}</p>
                </div>
            </div>

            <div className="flex items-center justify-between">
                <p className="text-sm text-slate-400">Framework: <span className="text-slate-100">{campaign.framework || "Auto"}</span></p>
                <Button onClick={onAdvance} disabled={!hasBrief} className="bg-white text-slate-900 hover:bg-slate-200">
                    Continue to Wireframes
                </Button>
            </div>

            {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        </GlassCard>
    );
}
