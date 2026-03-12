// Client-side API wrapper for campaign operations

const API_BASE = process.env.NEXT_PUBLIC_API_URL + "/campaigns";

export interface Campaign {
    id: string;
    name: string;
    description?: string;
    status: string;
    targetCount: number;
    completedCount: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface CampaignFilters {
    status?: string;
    limit?: number;
    offset?: number;
}

export async function getCampaigns(filters?: CampaignFilters) {
    const params = new URLSearchParams();
    if (filters?.status) params.set("status", filters.status);
    if (filters?.limit) params.set("limit", filters.limit.toString());
    if (filters?.offset) params.set("offset", filters.offset.toString());

    const url = `${API_BASE}?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch campaigns");
    return res.json();
}

export async function getCampaign(id: string) {
    const res = await fetch(`${API_BASE}/${id}`);
    if (!res.ok) throw new Error("Failed to fetch campaign");
    return res.json();
}

export async function createCampaign(data: {
    name: string;
    description?: string;
    targetCount?: number;
}) {
    const res = await fetch(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to create campaign");
    return res.json();
}

export async function updateCampaign(
    id: string,
    data: {
        name?: string;
        description?: string;
        status?: string;
        targetCount?: number;
        completedCount?: number;
    }
) {
    const res = await fetch(`${API_BASE}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to update campaign");
    return res.json();
}

export async function deleteCampaign(id: string) {
    const res = await fetch(`${API_BASE}/${id}`, {
        method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete campaign");
    return res.json();
}

export async function assignLeads(campaignId: string, leadIds: string[]) {
    const res = await fetch(`${API_BASE}/${campaignId}/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds }),
    });
    if (!res.ok) throw new Error("Failed to assign leads");
    return res.json();
}

export async function removeLeads(campaignId: string, leadIds: string[]) {
    const res = await fetch(`${API_BASE}/${campaignId}/leads`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds }),
    });
    if (!res.ok) throw new Error("Failed to remove leads");
    return res.json();
}

export async function getCampaignAnalytics(id: string) {
    const res = await fetch(`${API_BASE}/${id}/analytics/v2`); // Updated to V2
    if (!res.ok) throw new Error("Failed to fetch analytics");
    const json = await res.json();
    return json.success ? json.data : json;
}
