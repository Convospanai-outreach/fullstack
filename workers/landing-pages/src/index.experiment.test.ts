import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "./index";

// The Worker's fetch with an in-memory KV. Pages and experiments are seeded as the API writes them.
const DEFAULT_HOST = "pages.test";
const CONNECTED = "go.brand.test";

function env(kv: Record<string, unknown>) {
    return {
        LANDING_PAGES: {
            get: async (key: string) => (key in kv ? kv[key] : null),
        },
        API_ORIGIN: "https://api.test",
        DEFAULT_HOST,
    } as never;
}

const pageA = { html: "<main>Offer A</main>", teamId: "team-1" };
const pageB = { html: "<main>Offer B</main>", teamId: "team-1" };

const baseKv = {
    "page:offer-a": pageA,
    "page:offer-b": pageB,
    [`host:${CONNECTED}`]: "team-1",
    [`exp:${CONNECTED}:spring`]: {
        experimentId: "11111111-2222-4333-8444-555555555555",
        teamId: "team-1",
        mode: "test",
        weightA: 50,
        arms: { A: "offer-a", B: "offer-b" },
    },
};

function get(kv: Record<string, unknown>, path: string, headers: Record<string, string> = {}) {
    const url = `https://${CONNECTED}${path}`;
    return worker.fetch(new Request(url, { headers: { "User-Agent": "Mozilla/5.0 Chrome/120.0", ...headers } }), env(kv));
}

describe("Worker experiment routing", () => {
    afterEach(() => vi.restoreAllMocks());

    it("sends a new visitor to the drawn arm, sets the sticky cookie, and varies the cache on the cookie", async () => {
        vi.spyOn(Math, "random").mockReturnValue(0.1);
        const res = await get(baseKv, "/spring");

        expect(res.status).toBe(200);
        expect(await res.text()).toBe("<main>Offer A</main>");
        expect(res.headers.get("set-cookie")).toBe(
            "cmf_ab_11111111-2222-4333-8444-555555555555=A; Max-Age=2592000; Path=/; Secure; SameSite=Lax",
        );
        expect(res.headers.get("vary")).toBe("Cookie");
        expect(res.headers.get("cache-control")).toContain("private");
    });

    it("keeps a returning visitor on the arm in the cookie, with no new cookie", async () => {
        vi.spyOn(Math, "random").mockReturnValue(0.1);
        const res = await get(baseKv, "/spring", { Cookie: "cmf_ab_11111111-2222-4333-8444-555555555555=B" });

        expect(await res.text()).toBe("<main>Offer B</main>");
        expect(res.headers.get("set-cookie")).toBeNull();
    });

    it("sends a crawler to A with no cookie", async () => {
        vi.spyOn(Math, "random").mockReturnValue(0.9);
        const res = await get(baseKv, "/spring", { "User-Agent": "Googlebot/2.1" });

        expect(await res.text()).toBe("<main>Offer A</main>");
        expect(res.headers.get("set-cookie")).toBeNull();
    });

    it("sends everyone to A while the test is paused", async () => {
        const kv = { ...baseKv, [`exp:${CONNECTED}:spring`]: { ...baseKv[`exp:${CONNECTED}:spring`], mode: "fixed", fixedVariant: "A" } };
        const res = await get(kv, "/spring", { Cookie: "cmf_ab_11111111-2222-4333-8444-555555555555=B" });

        expect(await res.text()).toBe("<main>Offer A</main>");
        expect(res.headers.get("set-cookie")).toBeNull();
    });

    it("sends everyone to the winner once the test has ended", async () => {
        const kv = { ...baseKv, [`exp:${CONNECTED}:spring`]: { ...baseKv[`exp:${CONNECTED}:spring`], mode: "fixed", fixedVariant: "B" } };
        const res = await get(kv, "/spring");

        expect(await res.text()).toBe("<main>Offer B</main>");
    });

    it("does not serve a test whose domain belongs to another team", async () => {
        const kv = { ...baseKv, [`host:${CONNECTED}`]: "team-2" };
        const res = await get(kv, "/spring");

        expect(res.status).toBe(404);
    });

    it("keeps serving a normal page on the same domain", async () => {
        const kv = { ...baseKv, "page:about": { html: "<main>About</main>", teamId: "team-1" } };
        const res = await get(kv, "/about");

        expect(await res.text()).toBe("<main>About</main>");
        expect(res.headers.get("cache-control")).toBe("public, max-age=60");
    });

    it("returns 404 for an unknown path", async () => {
        const res = await get(baseKv, "/nothing-here");
        expect(res.status).toBe(404);
    });
});
