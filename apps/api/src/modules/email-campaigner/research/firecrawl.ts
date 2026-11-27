// Minimal Firecrawl v2 client (plain fetch, no SDK). Used only by company research.
//
// Retries follow Firecrawl's own error guide: 408, 429 and 5xx are retried (a 429 waits Retry-After
// seconds, capped); 400, 401, 402, 403 are not. Each call has a short timeout because this runs
// inside the sequence worker, and the API default is 60 s.

const BASE = "https://api.firecrawl.dev/v2";
const TIMEOUT_MS = 20_000;
const MAX_ATTEMPTS = 3;
const MAX_WAIT_MS = 5_000;
const RETRYABLE = new Set([408, 429, 500, 502, 503, 504]);

export class FirecrawlError extends Error {
    constructor(message: string, readonly status: number, readonly retryable: boolean) {
        super(message);
        this.name = "FirecrawlError";
    }
}

export function firecrawlConfigured(): boolean {
    return Boolean(process.env["FIRECRAWL_API_KEY"]);
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function firecrawlPost<T>(
    path: string,
    body: unknown,
    fetchImpl: typeof fetch = fetch,
    sleep: (ms: number) => Promise<void> = defaultSleep,
): Promise<T> {
    const key = process.env["FIRECRAWL_API_KEY"];
    if (!key) throw new FirecrawlError("FIRECRAWL_API_KEY is not set", 0, false);

    let last: FirecrawlError = new FirecrawlError("Firecrawl request failed", 0, true);
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        let waitMs = 500 * attempt;
        try {
            const res = await fetchImpl(`${BASE}${path}`, {
                method: "POST",
                headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(TIMEOUT_MS),
            });
            if (res.ok) return (await res.json()) as T;

            const detail = (await res.json().catch(() => null)) as { error?: unknown } | null;
            const message = typeof detail?.error === "string" ? detail.error.slice(0, 200) : `HTTP ${res.status}`;
            last = new FirecrawlError(message, res.status, RETRYABLE.has(res.status));
            if (!last.retryable) throw last;
            const retryAfter = Number(res.headers.get("retry-after"));
            if (Number.isFinite(retryAfter) && retryAfter > 0) waitMs = Math.min(retryAfter * 1000, MAX_WAIT_MS);
        } catch (error) {
            if (error instanceof FirecrawlError && !error.retryable) throw error;
            if (!(error instanceof FirecrawlError)) last = new FirecrawlError(error instanceof Error ? error.message : String(error), 0, true);
        }
        if (attempt < MAX_ATTEMPTS) await sleep(waitMs);
    }
    throw last;
}
