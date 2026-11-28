import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { buildOverpassQuery, resolveTerm, SUPPORTED_TERMS } from "../tagMap";
import { createOverpassClient, OverpassError } from "../overpassClient";
import { toCandidates } from "../normalize";
import { createOsmDiscovery, OSM_ATTRIBUTION, resolveOverpassUrl } from "../osmDiscovery";

const fixture = JSON.parse(
    readFileSync(path.join(__dirname, "fixtures", "overpass-dentists.json"), "utf8"),
);

const AREA = { lat: 18.52, lon: 73.85, radiusMeters: 3000 };

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

// A fake clock: sleep() advances time instead of waiting, and every wait is recorded.
function fakeClock() {
    let t = 1_000_000;
    const waits: number[] = [];
    return {
        now: () => t,
        sleep: async (ms: number) => { waits.push(ms); t += ms; },
        advance: (ms: number) => { t += ms; },
        waits,
    };
}

describe("term to tag map", () => {
    it("maps a known term to its OSM tags", () => {
        expect(resolveTerm("Dentists")).toEqual({ ok: true, term: "dentist", tags: [{ key: "amenity", value: "dentist" }] });
    });

    it("says a term is unsupported instead of falling back to a catch-all", () => {
        const result = resolveTerm("saas companies");
        expect(result).toEqual({ ok: false, reason: "unsupported_term", term: "saas companies" });
        expect(JSON.stringify(SUPPORTED_TERMS)).not.toContain("office=company");
    });

    it("builds a bounded query with a server-side timeout and only the mapped tags", () => {
        const resolved = resolveTerm("dentist");
        if (!resolved.ok) throw new Error("expected a mapping");
        const query = buildOverpassQuery(resolved.tags, AREA, 25);
        expect(query).toContain("[out:json][timeout:25]");
        expect(query).toContain('nwr["amenity"="dentist"](around:3000,18.52,73.85);');
        expect(query).toContain("out tags center");
    });

    it("rejects an area it cannot express safely", () => {
        const resolved = resolveTerm("dentist");
        if (!resolved.ok) throw new Error("expected a mapping");
        expect(() => buildOverpassQuery(resolved.tags, { lat: 200, lon: 0, radiusMeters: 1000 })).toThrow();
        expect(() => buildOverpassQuery(resolved.tags, { lat: 0, lon: 0, radiusMeters: 999_999 })).toThrow();
    });
});

describe("Overpass client etiquette", () => {
    it("keeps at least 2 s between calls and runs one at a time", async () => {
        const clock = fakeClock();
        let inFlight = 0;
        let maxInFlight = 0;
        const fetchImpl = vi.fn(async () => {
            inFlight++;
            maxInFlight = Math.max(maxInFlight, inFlight);
            await Promise.resolve();
            inFlight--;
            return jsonResponse({ elements: [] });
        });
        const client = createOverpassClient({ url: "https://overpass.test/api/interpreter", fetchImpl, now: clock.now, sleep: clock.sleep, random: () => 0 });

        await Promise.all([client.run("q1"), client.run("q2"), client.run("q3")]);

        expect(fetchImpl).toHaveBeenCalledTimes(3);
        expect(maxInFlight).toBe(1);
        expect(clock.waits.filter(w => w >= 2000)).toHaveLength(2);
    });

    it("retries 429 and 5xx with backoff, honouring Retry-After", async () => {
        const clock = fakeClock();
        const fetchImpl = vi.fn()
            .mockResolvedValueOnce(jsonResponse({}, 429, { "retry-after": "7" }))
            .mockResolvedValueOnce(jsonResponse({}, 504))
            .mockResolvedValueOnce(jsonResponse({ elements: [{ type: "node", id: 1 }] }));
        const client = createOverpassClient({ url: "https://overpass.test/api/interpreter", fetchImpl, now: clock.now, sleep: clock.sleep, random: () => 0.5 });

        const body = await client.run("q");

        expect(body.elements).toHaveLength(1);
        expect(fetchImpl).toHaveBeenCalledTimes(3);
        expect(clock.waits).toContain(7000);
        // The second retry backs off further than the first base delay.
        expect(Math.max(...clock.waits)).toBeGreaterThanOrEqual(7000);
    });

    it("fails fast on 400: a bad query is our bug, not something to retry", async () => {
        const clock = fakeClock();
        const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, 400));
        const client = createOverpassClient({ url: "https://overpass.test/api/interpreter", fetchImpl, now: clock.now, sleep: clock.sleep, random: () => 0 });

        await expect(client.run("bad")).rejects.toBeInstanceOf(OverpassError);
        expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it("gives up after the retry budget", async () => {
        const clock = fakeClock();
        const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, 503));
        const client = createOverpassClient({ url: "https://overpass.test/api/interpreter", fetchImpl, now: clock.now, sleep: clock.sleep, random: () => 0, maxRetries: 2 });

        await expect(client.run("q")).rejects.toMatchObject({ status: 503 });
        expect(fetchImpl).toHaveBeenCalledTimes(3);
    });

    it("sends the query as form data with an identifying User-Agent", async () => {
        const clock = fakeClock();
        const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ elements: [] }));
        const client = createOverpassClient({ url: "https://overpass.test/api/interpreter", fetchImpl, now: clock.now, sleep: clock.sleep, random: () => 0 });

        await client.run("[out:json];node(1);out;");

        const [url, init] = fetchImpl.mock.calls[0]!;
        expect(url).toBe("https://overpass.test/api/interpreter");
        expect(init.method).toBe("POST");
        expect(String(init.body)).toBe("data=" + encodeURIComponent("[out:json];node(1);out;"));
        expect(init.headers["User-Agent"]).toMatch(/CraftMyFunnel/);
    });
});

describe("normalising Overpass elements into lead candidates", () => {
    const candidates = toCandidates(fixture.elements);

    it("merges phone/contact:phone and website/contact:website", () => {
        const bright = candidates.find(c => c.company === "Bright Teeth")!;
        expect(bright.phone).toBe("+91 20 9999 0000");
        expect(bright.website).toBe("brightteeth.example");
        expect(bright.domain).toBe("brightteeth.example");
        expect(bright.email).toBe("hello@brightteeth.example");
    });

    it("dedupes by domain and drops elements without a name", () => {
        expect(candidates.map(c => c.company)).toEqual(["Smile Dental Clinic", "Bright Teeth", "No Website Dental"]);
    });

    it("keeps the address, tags every row as OSM, and stores nothing it was not given", () => {
        const smile = candidates[0]!;
        expect(smile).toMatchObject({
            source: "osm",
            osmRef: "node/101",
            domain: "smiledental.example",
            address: "FC Road, Pune, 411004",
            email: null,
        });
        const noSite = candidates.find(c => c.company === "No Website Dental")!;
        expect(noSite).toMatchObject({ website: null, domain: null, email: null, phone: "020 5555 1111" });
    });
});

describe("OSM discovery provider", () => {
    it("refuses to run in production without OVERPASS_URL", () => {
        expect(resolveOverpassUrl({ NODE_ENV: "production" })).toEqual({ ok: false, reason: "overpass_url_missing" });
        expect(resolveOverpassUrl({ NODE_ENV: "production", OVERPASS_FALLBACK_URLS: "https://overpass-api.de/api/interpreter" }))
            .toEqual({ ok: false, reason: "overpass_url_missing" });
        expect(resolveOverpassUrl({ NODE_ENV: "production", OVERPASS_URL: "https://overpass.internal/api/interpreter" }))
            .toEqual({ ok: true, url: "https://overpass.internal/api/interpreter" });
    });

    it("allows the dev-only fallback outside production, and refuses when nothing is set", () => {
        expect(resolveOverpassUrl({ NODE_ENV: "development", OVERPASS_FALLBACK_URLS: "https://a.test/i, https://b.test/i" }))
            .toEqual({ ok: true, url: "https://a.test/i" });
        expect(resolveOverpassUrl({ NODE_ENV: "development" })).toEqual({ ok: false, reason: "overpass_url_missing" });
        expect(resolveOverpassUrl({ NODE_ENV: "development", OVERPASS_URL: "ftp://x" })).toEqual({ ok: false, reason: "overpass_url_invalid" });
    });

    it("returns the disabled reason without calling Overpass", async () => {
        const fetchImpl = vi.fn();
        const discovery = createOsmDiscovery({ env: { NODE_ENV: "production" }, fetchImpl });
        await expect(discovery.discover({ term: "dentist", area: AREA })).resolves.toEqual({ ok: false, reason: "overpass_url_missing" });
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it("returns unsupported_term without calling Overpass", async () => {
        const fetchImpl = vi.fn();
        const discovery = createOsmDiscovery({ env: { NODE_ENV: "production", OVERPASS_URL: "https://o.test/i" }, fetchImpl });
        await expect(discovery.discover({ term: "fintech startups", area: AREA }))
            .resolves.toEqual({ ok: false, reason: "unsupported_term", term: "fintech startups" });
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it("returns capped candidates with the attribution, and caches by query", async () => {
        const clock = fakeClock();
        const fetchImpl = vi.fn().mockImplementation(async () => jsonResponse(fixture));
        const discovery = createOsmDiscovery({
            env: { NODE_ENV: "production", OVERPASS_URL: "https://o.test/i" },
            fetchImpl, now: clock.now, sleep: clock.sleep, random: () => 0,
        });

        const first = await discovery.discover({ term: "dentist", area: AREA, maxResults: 2 });
        expect(first).toMatchObject({ ok: true, attribution: OSM_ATTRIBUTION, truncated: true, cached: false });
        if (!first.ok) throw new Error("expected results");
        expect(first.candidates).toHaveLength(2);
        expect(first.stats).toEqual({ total: 3, withWebsite: 2, withPhone: 3, withEmail: 1 });

        const second = await discovery.discover({ term: "dentist", area: AREA, maxResults: 2 });
        expect(second).toMatchObject({ ok: true, cached: true });
        expect(fetchImpl).toHaveBeenCalledTimes(1);

        clock.advance(8 * 24 * 60 * 60 * 1000);
        await discovery.discover({ term: "dentist", area: AREA, maxResults: 2 });
        expect(fetchImpl).toHaveBeenCalledTimes(2);
    });
});
