import type { LandingCampaign, LandingCampaignSummary } from "../types";
import { getBrowserApiBase } from "@/lib/api/browserBase";

const API_BASE = getBrowserApiBase();

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
        ...init,
        headers: {
            "Content-Type": "application/json",
            ...(init?.headers || {}),
        },
    });

    const text = await res.text();
    const payload = text ? JSON.parse(text) : null;
    if (!res.ok) {
        throw new Error(payload?.error || payload?.message || `Request failed: ${res.status}`);
    }
    return payload as T;
}

export const landingAgentApi = {
    createCampaign(input: {
        name: string;
        prompt: string;
        framework?: string;
        linkedCampaignId?: string | null;
        icpId: string;
    }) {
        return request<{ id: string }>("/landing-agent/campaigns", {
            method: "POST",
            body: JSON.stringify(input),
        });
    },

    createCampaignFromTemplate(input: { templateId: string; name: string; path?: string }) {
        return request<{ campaignId: string; pageId: string }>("/landing-agent/campaigns/from-template", {
            method: "POST",
            body: JSON.stringify(input),
        });
    },

    addAsset(campaignId: string, input: { text?: string; pdfKnowledgeItemId?: string; sourceName?: string }) {
        return request(`/landing-agent/campaigns/${campaignId}/assets`, {
            method: "POST",
            body: JSON.stringify(input),
        });
    },

    async uploadImage(file: File): Promise<{ url: string }> {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch(`${API_BASE}/landing-agent/images`, { method: "POST", body: form });
        const text = await res.text();
        const payload = text ? JSON.parse(text) : null;
        if (!res.ok) {
            throw new Error(payload?.error || `Image upload failed: ${res.status}`);
        }
        return payload as { url: string };
    },

    listCampaigns() {
        return request<{ campaigns: LandingCampaignSummary[]; liveDomain: string | null; domains: string[] }>("/landing-agent/campaigns");
    },

    setPageSlug(campaignId: string, pageId: string, path: string) {
        return request<{ id: string; slug: string }>(`/landing-agent/campaigns/${campaignId}/pages/${pageId}/slug`, {
            method: "PATCH",
            body: JSON.stringify({ path }),
        });
    },

    getCampaign(campaignId: string) {
        return request<LandingCampaign>(`/landing-agent/campaigns/${campaignId}`);
    },

    generateBrief(campaignId: string, framework?: string) {
        return request(`/landing-agent/campaigns/${campaignId}/brief`, {
            method: "POST",
            body: JSON.stringify({ framework }),
        });
    },

    generateWireframes(campaignId: string) {
        return request(`/landing-agent/campaigns/${campaignId}/wireframes`, {
            method: "POST",
            body: "{}",
        });
    },

    selectWireframe(campaignId: string, wireframeId: string) {
        return request(`/landing-agent/campaigns/${campaignId}/select-wireframe`, {
            method: "POST",
            body: JSON.stringify({ wireframeId }),
        });
    },

    saveEditorState(campaignId: string, input: { title?: string; editorState?: unknown; renderedJson: unknown }) {
        return request(`/landing-agent/campaigns/${campaignId}/editor-state`, {
            method: "PUT",
            body: JSON.stringify(input),
        });
    },

    generateImages(campaignId: string, pageId: string) {
        return request(`/landing-agent/campaigns/${campaignId}/pages/${pageId}/images`, {
            method: "POST",
            body: "{}",
        });
    },

    saveTracking(
        campaignId: string,
        pageId: string,
        tracking: { ga4Id: string; gtmId: string; hotjarId: string; metaPixelId: string; metaTestEventCode: string }
    ) {
        return request<{ page: { status: string }; cloudflare: { status: string } | null }>(
            `/landing-agent/campaigns/${campaignId}/pages/${pageId}/tracking`,
            { method: "PUT", body: JSON.stringify(tracking) }
        );
    },

    // Team-level Meta Conversions API token. Only the saved flag comes back; the token is never returned.
    getMetaCapiToken() {
        return request<{ saved: boolean }>(`/landing-agent/meta-capi-token`);
    },

    saveMetaCapiToken(accessToken: string) {
        return request<{ saved: boolean }>(`/landing-agent/meta-capi-token`, { method: "PUT", body: JSON.stringify({ accessToken }) });
    },

    deleteMetaCapiToken() {
        return request<{ saved: boolean }>(`/landing-agent/meta-capi-token`, { method: "DELETE" });
    },

    discardDraft(campaignId: string, pageId: string) {
        return request(`/landing-agent/campaigns/${campaignId}/pages/${pageId}/discard-draft`, {
            method: "POST",
            body: "{}",
        });
    },

    publish(campaignId: string, requireApproval = false) {
        return request(`/landing-agent/campaigns/${campaignId}/publish`, {
            method: "POST",
            body: JSON.stringify({ requireApproval }),
        });
    },
};

export async function uploadPdfToKnowledge(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE}/upload/pdf`, {
        method: "POST",
        body: formData,
    });
    const payload = await res.json();
    if (!res.ok) {
        throw new Error(payload?.error || "PDF upload failed");
    }
    return payload as { documentId: string; title?: string };
}
