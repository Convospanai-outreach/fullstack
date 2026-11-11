import type { MetaLeadEventPayload } from "./metaCapi";

// One POST of events to a pixel's Conversions API edge. The token goes in the Authorization header only, and
// failure results never carry an error message (a network error can echo the request), so the token cannot leak
// into the job's stored error or logs.
export const META_GRAPH_VERSION = "v26.0"; // Same version the WhatsApp Graph calls use (wabaCredentials.ts).
const REQUEST_TIMEOUT_MS = 10_000;

export type MetaSendResult =
    | { ok: true }
    | { ok: false; retryable: boolean; status?: number; reason: string };

export async function sendMetaLeadEvents(input: {
    pixelId: string;
    accessToken: string;
    payload: MetaLeadEventPayload;
    fetchImpl?: typeof fetch;
}): Promise<MetaSendResult> {
    const fetchImpl = input.fetchImpl ?? fetch;
    const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${encodeURIComponent(input.pixelId)}/events`;
    try {
        const response = await fetchImpl(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${input.accessToken}`,
            },
            body: JSON.stringify(input.payload),
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        if (response.ok) return { ok: true };
        // Rate limits and server errors come back; other 4xx (bad token, bad pixel) never will.
        const retryable = response.status === 429 || response.status >= 500;
        return { ok: false, retryable, status: response.status, reason: `Meta responded ${response.status}` };
    } catch (error) {
        const reason = error instanceof Error && error.name === "AbortError" ? "Meta request timed out" : "Meta request failed";
        return { ok: false, retryable: true, reason };
    }
}
