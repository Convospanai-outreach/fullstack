"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";
import GrapesEditor from "@/components/landing-agent/GrapesEditor";
import { landingAgentApi } from "@/modules/landing-agent/service/landingAgentApi";
import type { LandingCampaign } from "@/modules/landing-agent/types";

export default function LandingAgentEditorPage() {
    const params = useParams<{ id: string }>();
    const router = useRouter();
    const campaignId = typeof params?.id === "string" ? params.id : "";

    const [campaign, setCampaign] = useState<LandingCampaign | null>(null);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const loadCampaign = useCallback(async () => {
        if (!campaignId) return;
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

    if (loading) return <div className="p-8 text-muted-foreground">Loading editor...</div>;
    if (!campaign || error) return <div className="p-8 text-destructive">{error || "Campaign not found"}</div>;

    const page = campaign.pages[0];
    if (!page) {
        return (
            <div className="p-8 text-foreground">
                <GlassCard className="p-6">
                    Landing page not initialized. Select a wireframe first.
                </GlassCard>
            </div>
        );
    }

    return (
        <div className="p-6 lg:p-8 space-y-4">
            <GlassCard className="p-6 space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Step 3</p>
                <h1 className="text-2xl font-bold text-foreground">Constrained GrapesJS Editor</h1>
                <p className="text-sm text-muted-foreground">
                    Edit sections, save draft state, and publish to a public slug under `/p/[slug]`.
                </p>
                {status ? <p className="text-sm text-emerald-600">{status}</p> : null}
            </GlassCard>

            <GrapesEditor
                title={page.title || campaign.name}
                initialRenderedJson={page.renderedJson}
                onSave={async (payload) => {
                    await landingAgentApi.saveEditorState(campaignId, payload);
                    setStatus("Draft saved.");
                    await loadCampaign();
                }}
                onPublish={async () => {
                    const result: any = await landingAgentApi.publish(campaignId, false);
                    if (result?.status === "PENDING_APPROVAL") {
                        setStatus("Publish request submitted for approval.");
                        return;
                    }
                    const slug = result?.page?.slug || campaign.pages[0]?.slug;
                    setStatus("Published successfully.");
                    if (slug) {
                        await fetch("/api/landing-agent/revalidate", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ slug }),
                        }).catch(() => {});
                        router.push(`/p/${slug}`);
                    }
                }}
            />
        </div>
    );
}
