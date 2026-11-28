// OpenStreetMap discovery provider. Production must use a self-hosted or paid Overpass
// server (OVERPASS_URL): the public instances are not for commercial multi-tenant use, and
// their limits apply to the whole app. Without OVERPASS_URL in production the provider is
// disabled and says why. OVERPASS_FALLBACK_URLS (comma-separated) is honoured only outside
// production, for local development.
//
// This returns candidates; it does not create leads, and nothing calls it yet. Lead
// creation, the per-team daily cap and the UI come once hosting and the ODbL review are
// settled. Anything shown to users from these rows must carry OSM_ATTRIBUTION.
import { buildOverpassQuery, resolveTerm, type OsmArea } from "./tagMap";
import { createOverpassClient, type OverpassClientOptions } from "./overpassClient";
import { toCandidates, type OsmLeadCandidate } from "./normalize";

export const OSM_ATTRIBUTION = "© OpenStreetMap contributors";

const DEFAULT_MAX_RESULTS = 200;
const HARD_MAX_RESULTS = 500;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type Env = Record<string, string | undefined>;

export type OverpassUrl =
    | { ok: true; url: string }
    | { ok: false; reason: "overpass_url_missing" | "overpass_url_invalid" };

function httpUrl(value: string): string | null {
    try {
        const url = new URL(value.trim());
        return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
    } catch {
        return null;
    }
}

export function resolveOverpassUrl(env: Env): OverpassUrl {
    const configured = env["OVERPASS_URL"]?.trim();
    if (configured) {
        const url = httpUrl(configured);
        return url ? { ok: true, url } : { ok: false, reason: "overpass_url_invalid" };
    }
    if (env["NODE_ENV"] !== "production") {
        const fallback = (env["OVERPASS_FALLBACK_URLS"] ?? "").split(",").map(s => s.trim()).find(Boolean);
        if (fallback) {
            const url = httpUrl(fallback);
            return url ? { ok: true, url } : { ok: false, reason: "overpass_url_invalid" };
        }
    }
    return { ok: false, reason: "overpass_url_missing" };
}

export type DiscoverRequest = { term: string; area: OsmArea; maxResults?: number };

export type DiscoverResult =
    | {
        ok: true;
        candidates: OsmLeadCandidate[];
        truncated: boolean;
        cached: boolean;
        attribution: typeof OSM_ATTRIBUTION;
        // Coverage of the whole (deduplicated) result, so a caller can show how useful the free path is.
        stats: { total: number; withWebsite: number; withPhone: number; withEmail: number };
    }
    | { ok: false; reason: "overpass_url_missing" | "overpass_url_invalid" }
    | { ok: false; reason: "unsupported_term"; term: string };

export type OsmDiscoveryOptions = Omit<OverpassClientOptions, "url"> & { env?: Env };

export function createOsmDiscovery(options: OsmDiscoveryOptions = {}) {
    const { env = process.env, ...clientOptions } = options;
    const now = clientOptions.now ?? Date.now;
    const cache = new Map<string, { at: number; candidates: OsmLeadCandidate[] }>();
    let client: ReturnType<typeof createOverpassClient> | null = null;

    return {
        async discover(request: DiscoverRequest): Promise<DiscoverResult> {
            const target = resolveOverpassUrl(env);
            if (!target.ok) return target;
            const resolved = resolveTerm(request.term);
            if (!resolved.ok) return resolved;

            const query = buildOverpassQuery(resolved.tags, request.area);
            let entry = cache.get(query);
            const cached = !!entry && now() - entry.at < CACHE_TTL_MS;
            if (!cached) {
                client ??= createOverpassClient({ ...clientOptions, url: target.url });
                const response = await client.run(query);
                entry = { at: now(), candidates: toCandidates(response.elements) };
                cache.set(query, entry);
            }
            const all = entry!.candidates;
            const limit = Math.min(Math.max(1, request.maxResults ?? DEFAULT_MAX_RESULTS), HARD_MAX_RESULTS);
            return {
                ok: true,
                candidates: all.slice(0, limit),
                truncated: all.length > limit,
                cached,
                attribution: OSM_ATTRIBUTION,
                stats: {
                    total: all.length,
                    withWebsite: all.filter(c => c.website).length,
                    withPhone: all.filter(c => c.phone).length,
                    withEmail: all.filter(c => c.email).length,
                },
            };
        },
    };
}
