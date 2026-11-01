"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";
import GrapesEditor from "@/components/landing-agent/GrapesEditor";
import PageTrackingPanel from "@/components/landing-agent/PageTrackingPanel";
import { pageLink, readShownDomain, shownDomain } from "@/components/landing-agent/landingPageAddress";
import UnpublishedChangesBanner from "./UnpublishedChangesBanner";
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
    // Bumped after a discard so the canvas remounts with the live content.
    const [editorKey, setEditorKey] = useState(0);
    const [metaTokenSaved, setMetaTokenSaved] = useState(false);
    useEffect(() => {
        landingAgentApi.getMetaCapiToken().then((result) => setMetaTokenSaved(result.saved)).catch(() => setMetaTokenSaved(false));
    }, []);

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

            {page.hasUnpublishedChanges ? (
                <UnpublishedChangesBanner
                    onDiscard={async () => {
                        await landingAgentApi.discardDraft(campaignId, page.id);
                        await loadCampaign();
                        setStatus("Unpublished changes discarded.");
                        setEditorKey((key) => key + 1);
                    }}
                />
            ) : null}

            <GrapesEditor
                key={editorKey}
                title={page.title || campaign.name}
                pageStatus={page.status}
                pageSlug={page.slug}
                initialRenderedJson={page.renderedJson}
                onSave={async (payload) => {
                    await landingAgentApi.saveEditorState(campaignId, payload);
                    setStatus("Draft saved.");
                    await loadCampaign();
                }}
                onGenerateImages={async () => {
                    const updatedPage: any = await landingAgentApi.generateImages(campaignId, page.id);
                    setStatus("Images generated.");
                    await loadCampaign();
                    return updatedPage?.renderedJson;
                }}
                onPublish={async () => {
                    const result: any = await landingAgentApi.publish(campaignId, false);
                    if (result?.status === "PENDING_APPROVAL") {
                        setStatus("Publish request submitted for approval.");
                        return;
                    }
                    const slug = result?.page?.slug || campaign.pages[0]?.slug;
                    const cloudflareStatus = result?.cloudflare?.status;
                    if (cloudflareStatus === "error") {
                        // The page is saved as published, but the live copy on
                        // Cloudflare's edge failed to update - don't redirect, so the
                        // warning stays visible and the user can retry.
                        setStatus("Published, but syncing the live page to Cloudflare failed. The public page may be out of date - check the server logs and publish again.");
                        return;
                    }
                    if (cloudflareStatus === "skipped") {
                        setStatus("Published. Cloudflare edge delivery isn't configured, so the page is only served from a preview link, not a custom domain.");
                    } else {
                        setStatus("Published successfully.");
                    }
                    if (slug) {
                        await fetch("/api/landing-agent/revalidate", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ slug }),
                        }).catch(() => {});
                        if (result?.liveDomain) {
                            // The team's connected domain serves the page from Cloudflare: the one picked in the page list, else the oldest.
                            const domains = await landingAgentApi.listCampaigns().then((data) => data.domains ?? [], () => []);
                            window.location.assign(pageLink(shownDomain(domains, readShownDomain()) ?? result.liveDomain, slug));
                        } else {
                            router.push(`/p/${slug}`);
                        }
                    }
                }}
            />

            <PageTrackingPanel
                initial={page.tracking ?? null}
                metaTokenSaved={metaTokenSaved}
                onSaveMetaToken={async (accessToken) => {
                    const result = await landingAgentApi.saveMetaCapiToken(accessToken);
                    setMetaTokenSaved(result.saved);
                    return "Access token saved.";
                }}
                onClearMetaToken={async () => {
                    const result = await landingAgentApi.deleteMetaCapiToken();
                    setMetaTokenSaved(result.saved);
                    return "Access token removed.";
                }}
                onSave={async (tracking) => {
                    const result = await landingAgentApi.saveTracking(campaignId, page.id, tracking);
                    if (result.page.status !== "published") return "Saved. Tracking starts once the page is published.";
                    if (result.cloudflare?.status === "pushed") return "Saved. The live page on your connected domain now uses these IDs.";
                    if (result.cloudflare?.status === "error") throw new Error("Saved, but updating the live page failed. Publish again to retry.");
                    return "Saved. Tracking will run once a domain is connected in Settings → Branding.";
                }}
            />
        </div>
    );
}
