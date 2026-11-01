import { getBrowserApiBase } from "@/lib/api/browserBase";

// Client for the A/B test endpoints (phase 6B). Responses are the API's JSON payloads.
const API_BASE = getBrowserApiBase();

export interface ExperimentVariantRow {
    id: string;
    name: "A" | "B";
    landingPageId: string;
    weight: number;
}

export interface ExperimentRow {
    id: string;
    name: string;
    slug: string;
    status: "draft" | "running" | "paused" | "ended";
    winnerPageId: string | null;
    startedAt: string | null;
    variants: ExperimentVariantRow[];
}

export interface ExperimentResults {
    experimentId: string;
    status: ExperimentRow["status"];
    variants: Record<"A" | "B", { visitors: number; formStarts: number; leads: number; conversionRate: number }>;
    verdict: {
        status: "not_enough_data" | "no_clear_difference" | "clear_winner";
        winner: "A" | "B" | null;
        readiness: "ready" | "not_enough_visitors" | "not_enough_days";
        difference: number;
        confidence: number;
        rateA: number;
        rateB: number;
    };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
        ...init,
        headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    });
    const text = await res.text();
    const payload = text ? JSON.parse(text) : null;
    if (!res.ok) {
        throw new Error(payload?.error || payload?.message || `Request failed: ${res.status}`);
    }
    return payload as T;
}

export const landingExperimentApi = {
    list() {
        return request<ExperimentRow[]>("/landing-agent/experiments");
    },

    create(input: { name: string; slug: string; pageAId: string; pageBId: string; weightA: number }) {
        return request<ExperimentRow>("/landing-agent/experiments", { method: "POST", body: JSON.stringify(input) });
    },

    results(experimentId: string) {
        return request<ExperimentResults>(`/landing-agent/experiments/${encodeURIComponent(experimentId)}`);
    },

    act(experimentId: string, action: "start" | "pause" | "end", ) {
        return request<ExperimentRow>(`/landing-agent/experiments/${encodeURIComponent(experimentId)}/${action}`, {
            method: "POST",
            body: JSON.stringify({}),
        });
    },

    pickWinner(experimentId: string, pageId: string) {
        return request<ExperimentRow>(`/landing-agent/experiments/${encodeURIComponent(experimentId)}/winner`, {
            method: "POST",
            body: JSON.stringify({ pageId }),
        });
    },
};
