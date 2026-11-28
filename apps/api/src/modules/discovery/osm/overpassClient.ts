// Overpass API client that follows the published usage etiquette: one request at a time,
// at least 2 s between requests, exponential backoff with jitter, Retry-After honoured, and
// retries only on 429 and 5xx. Any other error status (such as 400 for a malformed query)
// is our bug and fails at once. Clock, sleep, randomness and fetch are injectable so tests
// never touch a real server or wait in real time.

export type OverpassElement = {
    type: "node" | "way" | "relation";
    id: number;
    tags?: Record<string, string>;
    lat?: number;
    lon?: number;
    center?: { lat: number; lon: number };
};

export type OverpassResponse = { elements: OverpassElement[] };

export class OverpassError extends Error {
    constructor(message: string, readonly status: number | null) {
        super(message);
        this.name = "OverpassError";
    }
}

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<Response>;

export type OverpassClientOptions = {
    url: string;
    fetchImpl?: FetchLike;
    now?: () => number;
    sleep?: (ms: number) => Promise<void>;
    random?: () => number;
    minGapMs?: number;
    maxRetries?: number;
    baseBackoffMs?: number;
    requestTimeoutMs?: number;
};

const USER_AGENT = "CraftMyFunnel-OSM-Discovery/1.0 (+https://craftmyfunnel.live)";
const MAX_RETRY_AFTER_MS = 120_000;

function retryAfterMs(header: string | null, now: number): number | null {
    if (!header) return null;
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS);
    const date = Date.parse(header);
    return Number.isNaN(date) ? null : Math.min(Math.max(0, date - now), MAX_RETRY_AFTER_MS);
}

export function createOverpassClient(options: OverpassClientOptions) {
    const fetchImpl: FetchLike = options.fetchImpl ?? ((url, init) => fetch(url, init));
    const now = options.now ?? Date.now;
    const sleep = options.sleep ?? ((ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)));
    const random = options.random ?? Math.random;
    const minGapMs = options.minGapMs ?? 2000;
    const maxRetries = options.maxRetries ?? 3;
    const baseBackoffMs = options.baseBackoffMs ?? 2000;
    const requestTimeoutMs = options.requestTimeoutMs ?? 60_000;

    let lastRequestAt = Number.NEGATIVE_INFINITY;
    let queue: Promise<unknown> = Promise.resolve();

    async function send(query: string): Promise<Response> {
        const wait = lastRequestAt + minGapMs - now();
        if (wait > 0) await sleep(wait);
        lastRequestAt = now();
        try {
            return await fetchImpl(options.url, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": USER_AGENT, Accept: "application/json" },
                body: "data=" + encodeURIComponent(query),
                signal: AbortSignal.timeout(requestTimeoutMs),
            });
        } finally {
            lastRequestAt = now();
        }
    }

    async function runNow(query: string): Promise<OverpassResponse> {
        for (let attempt = 0; ; attempt++) {
            let response: Response;
            try {
                response = await send(query);
            } catch (error) {
                // Network failure or our own timeout: treat like a 5xx.
                if (attempt >= maxRetries) throw new OverpassError(`Overpass request failed: ${(error as Error).message}`, null);
                await sleep(baseBackoffMs * 2 ** attempt + random() * baseBackoffMs);
                continue;
            }
            if (response.ok) {
                const body = (await response.json()) as Partial<OverpassResponse>;
                return { elements: Array.isArray(body.elements) ? body.elements : [] };
            }
            const retryable = response.status === 429 || response.status >= 500;
            if (!retryable || attempt >= maxRetries) {
                throw new OverpassError(`Overpass responded ${response.status}`, response.status);
            }
            const hinted = retryAfterMs(response.headers.get("retry-after"), now());
            await sleep(hinted ?? baseBackoffMs * 2 ** attempt + random() * baseBackoffMs);
        }
    }

    return {
        // Calls are chained, so at most one request is ever in flight per client.
        run(query: string): Promise<OverpassResponse> {
            const result = queue.then(() => runNow(query));
            queue = result.catch(() => undefined);
            return result;
        },
    };
}
