import type { LandingCampaign } from "../types";

const API_BASE = process.env["NEXT_PUBLIC_API_URL"] || "/api/proxy";

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
    }) {
        return request<{ id: string }>("/landing-agent/campaigns", {
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
