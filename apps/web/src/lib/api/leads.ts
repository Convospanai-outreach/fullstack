// Client-side API wrapper for lead operations

const API_BASE = (process.env["NEXT_PUBLIC_API_URL"] || "/api/proxy") + "/leads";

export interface Lead {
    id: string;
    fullName?: string;
    email?: string;
    linkedIn?: string;
    status: string;
    campaignId?: string;
    createdAt: Date;
}

export interface LeadFilters {
    campaignId?: string;
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
}

export async function getLeads(filters?: LeadFilters) {
    const params = new URLSearchParams();
    if (filters?.campaignId) params.set("campaignId", filters.campaignId);
    if (filters?.status) params.set("status", filters.status);
    if (filters?.search) params.set("search", filters.search);
    if (filters?.limit) params.set("limit", filters.limit.toString());
    if (filters?.offset) params.set("offset", filters.offset.toString());

    const url = `${API_BASE}?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch leads");
    return res.json();
}

export async function getLead(id: string) {
    const res = await fetch(`${API_BASE}/${id}`);
    if (!res.ok) throw new Error("Failed to fetch lead");
    return res.json();
}

export async function createLead(data: {
    fullName?: string;
    email: string;
    linkedIn?: string;
    status?: string;
    campaignId?: string;
}) {
    const res = await fetch(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to create lead");
    return res.json();
}

export async function updateLead(
    id: string,
    data: {
        fullName?: string;
        email?: string;
        linkedIn?: string;
        status?: string;
        campaignId?: string;
    }
) {
    const res = await fetch(`${API_BASE}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to update lead");
    return res.json();
}

export async function deleteLead(id: string) {
    const res = await fetch(`${API_BASE}/${id}`, {
        method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete lead");
    return res.json();
}

export async function importCSV(
    csvText: string,
    fieldMapping?: { [key: string]: string },
    campaignId?: string
) {
    const apiBase = process.env["NEXT_PUBLIC_API_URL"] || "/api/proxy";
    const res = await fetch(apiBase + "/upload/csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            csv: csvText,
            fieldMapping,
            campaignId,
        }),
    });
    if (!res.ok) throw new Error("Failed to import CSV");
    return res.json();
}
