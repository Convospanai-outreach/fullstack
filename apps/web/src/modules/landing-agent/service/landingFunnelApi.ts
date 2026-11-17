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

export type FunnelSourceDimension = "utm_source" | "utm_medium" | "utm_campaign" | "utm_content";

export interface FunnelSourceRow {
    source: string;
    leads: number;
    contacted: number;
    replied: number;
    meetings: number;
    won: number;
}

export interface FunnelReportResponse {
    range: { from: string; to: string };
    filters: { landingPageId: string | null; variantId: string | null };
    steps: FunnelReportStep[];
    sideMetrics: { ctaClicks: number; qualified: number; medianSecondsLeadToQualified: number | null };
    instagram: { repliesSent: number } | null;
    // Sign-ups grouped by one UTM field. Absent from an API that has not been updated yet.
    sources?: { dimension: FunnelSourceDimension; rows: FunnelSourceRow[] };
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
    get(input: { from: string; to: string; landingPageId?: string | undefined; variantId?: string | undefined; groupBy?: FunnelSourceDimension | undefined }) {
        const params = new URLSearchParams({ from: input.from, to: input.to });
        if (input.landingPageId) params.set("landingPageId", input.landingPageId);
        if (input.variantId) params.set("variantId", input.variantId);
        if (input.groupBy) params.set("groupBy", input.groupBy);
        return request<FunnelReportResponse>(`/landing-agent/funnel?${params.toString()}`);
    },
};
