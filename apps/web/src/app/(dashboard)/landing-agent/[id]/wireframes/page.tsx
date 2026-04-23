"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/GlassCard";
import WireframeOptionCard from "@/components/landing-agent/WireframeOptionCard";
import { landingAgentApi } from "@/modules/landing-agent/service/landingAgentApi";
import type { LandingCampaign } from "@/modules/landing-agent/types";

export default function LandingAgentWireframesPage() {
    const params = useParams<{ id: string }>();
    const router = useRouter();
    const campaignId = typeof params?.id === "string" ? params.id : "";

    const [campaign, setCampaign] = useState<LandingCampaign | null>(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [selectingId, setSelectingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const loadCampaign = useCallback(async () => {
        if (!campaignId) return;
        setError(null);
        const data = await landingAgentApi.getCampaign(campaignId);
        setCampaign(data);
    }, [campaignId]);

    useEffect(() => {
        if (!campaignId) return;
        setLoading(true);
        loadCampaign()
            .catch((err: any) => setError(err?.message || "Failed to load campaign"))
            .finally(() => setLoading(false));
    }, [campaignId, loadCampaign]);

    async function handleGenerate() {
        if (!campaignId) return;
        setGenerating(true);
        setError(null);
        try {
            await landingAgentApi.generateWireframes(campaignId);
            await loadCampaign();
        } catch (err: any) {
            setError(err?.message || "Failed to generate wireframes");
        } finally {
            setGenerating(false);
        }
    }

    async function handleSelect(wireframeId: string) {
        if (!campaignId) return;
        setSelectingId(wireframeId);
        setError(null);
        try {
            await landingAgentApi.selectWireframe(campaignId, wireframeId);
            router.push(`/landing-agent/${campaignId}/editor`);
        } catch (err: any) {
            setError(err?.message || "Failed to select wireframe");
        } finally {
            setSelectingId(null);
        }
    }

    if (loading) return <div className="p-8 text-slate-300">Loading wireframes...</div>;
    if (!campaign || error) return <div className="p-8 text-rose-300">{error || "Campaign not found"}</div>;

    return (
        <div className="p-6 lg:p-8 space-y-6">
            <GlassCard className="p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Step 2</p>
                        <h1 className="mt-2 text-2xl font-bold text-white">Wireframe Directions</h1>
                        <p className="mt-2 text-sm text-slate-300">
                            Generate and compare three page directions, then open the selected one in editor.
                        </p>
                    </div>
                    <Button onClick={handleGenerate} disabled={generating} className="bg-cyan-600 hover:bg-cyan-500 text-white">
                        {generating ? "Generating..." : "Generate 3 Wireframes"}
                    </Button>
                </div>
                {error ? <p className="text-sm text-rose-300">{error}</p> : null}
            </GlassCard>

            {campaign.wireframeOptions.length === 0 ? (
                <GlassCard className="p-8 text-slate-300">No wireframes yet. Generate options to continue.</GlassCard>
            ) : (
                <div className="grid gap-5 lg:grid-cols-3">
                    {campaign.wireframeOptions.map((option) => (
                        <WireframeOptionCard
                            key={option.id}
                            option={option}
                            selected={campaign.selectedWireframeId === option.id}
                            selecting={selectingId === option.id}
                            onSelect={handleSelect}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
