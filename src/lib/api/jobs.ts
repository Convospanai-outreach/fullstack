// Client-side API wrapper for job operations

const API_BASE = process.env.NEXT_PUBLIC_API_URL + "/jobs";

export interface Job {
    id: string;
    type: string;
    status: string;
    priority: number;
    payload: any;
    result?: any;
    error?: string;
    attempts: number;
    maxAttempts: number;
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
}

export interface JobFilters {
    type?: string;
    status?: string;
    limit?: number;
    offset?: number;
}

export async function getJobs(filters?: JobFilters) {
    const params = new URLSearchParams();
    if (filters?.type) params.set("type", filters.type);
    if (filters?.status) params.set("status", filters.status);
    if (filters?.limit) params.set("limit", filters.limit.toString());
    if (filters?.offset) params.set("offset", filters.offset.toString());

    const url = `${API_BASE}?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch jobs");
    return res.json();
}

export async function getJob(id: string) {
    const res = await fetch(`${API_BASE}/${id}`);
    if (!res.ok) throw new Error("Failed to fetch job");
    return res.json();
}

export async function createJob(
    type: string,
    payload: any,
    priority?: number
) {
    const res = await fetch(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, payload, priority }),
    });
    if (!res.ok) throw new Error("Failed to create job");
    return res.json();
}

export async function retryJob(id: string) {
    const res = await fetch(`${API_BASE}/${id}/retry`, {
        method: "POST",
    });
    if (!res.ok) throw new Error("Failed to retry job");
    return res.json();
}

export async function cancelJob(id: string) {
    const res = await fetch(`${API_BASE}/${id}`, {
        method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to cancel job");
    return res.json();
}
