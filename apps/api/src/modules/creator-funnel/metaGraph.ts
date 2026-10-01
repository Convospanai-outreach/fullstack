// Minimal Meta Graph API client for the creator funnel publisher. Tokens go in the request body
// (POST) or query (GET) and are never logged. Every call has a timeout; a timeout, a network
// failure or a 5xx is "uncertain": Meta may or may not have done it, so the publisher never
// repeats a publishing call that ended that way.
//
// Version: v26.0 is current (https://developers.facebook.com/docs/graph-api/changelog/versions,
// checked 2026-09-30).

export const GRAPH_BASE_URL = "https://graph.facebook.com/v26.0";
const TIMEOUT_MS = 15_000;

export class GraphError extends Error {
    constructor(message: string, public readonly uncertain: boolean) {
        super(message);
    }
}

export async function graphCall(method: "GET" | "POST", path: string, params: Record<string, string>, token: string): Promise<any> {
    const query = new URLSearchParams({ ...params, access_token: token });
    const url = `${GRAPH_BASE_URL}/${path}`;
    let res: Response;
    try {
        res = await fetch(method === "GET" ? `${url}?${query}` : url, {
            method,
            ...(method === "POST" ? { body: query, headers: { "Content-Type": "application/x-www-form-urlencoded" } } : {}),
            redirect: "error",
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
    } catch {
        throw new GraphError("Meta didn't answer in time.", true);
    }
    const json: any = await res.json().catch(() => null);
    if (!res.ok) {
        const message = typeof json?.error?.message === "string" ? json.error.message : `Meta returned HTTP ${res.status}.`;
        throw new GraphError(message.slice(0, 300), res.status >= 500);
    }
    return json;
}
