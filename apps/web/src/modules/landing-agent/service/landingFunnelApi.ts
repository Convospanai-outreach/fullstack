import { getBrowserApiBase } from "@/lib/api/browserBase";

// Client for the landing page funnel report (phase 12). Responses are the API's JSON payloads.
const API_BASE = getBrowserApiBase();

export interface FunnelReportStep {
    key: string;
    label: string;
    count: number;
    dropOffPercent: number | null;
    medianSecondsFromPrevious: number | null;
}

export interface FunnelReportResponse {
    range: { from: string; to: string };
    filters: { landingPageId: string | null; variantId: string | null };
    steps: FunnelReportStep[];
    sideMetrics: { ctaClicks: number; qualified: number; medianSecondsLeadToQualified: number | null };
    instagram: { repliesSent: number } | null;
}

async function request<T>(path: string): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, { headers: { "Content-Type": "application/json" } });
    const text = await res.text();
    const payload = text ? JSON.parse(text) : null;
    if (!res.ok) {
        throw new Error(payload?.error || payload?.message || `Request failed: ${res.status}`);
    }
    return payload as T;
}

export const landingFunnelApi = {
    get(input: { from: string; to: string; landingPageId?: string; variantId?: string }) {
        const params = new URLSearchParams({ from: input.from, to: input.to });
        if (input.landingPageId) params.set("landingPageId", input.landingPageId);
        if (input.variantId) params.set("variantId", input.variantId);
        return request<FunnelReportResponse>(`/landing-agent/funnel?${params.toString()}`);
    },
};
