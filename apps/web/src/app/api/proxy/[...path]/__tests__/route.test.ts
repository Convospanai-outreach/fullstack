import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isApiOnlyCampaignPath, isWebOwnedPath, POST } from "../route";

vi.mock("next-auth/jwt", () => ({ getToken: vi.fn().mockResolvedValue(null) }));

describe("isApiOnlyCampaignPath", () => {
    it("leaves the campaign routes apps/web implements alone", () => {
        expect(isApiOnlyCampaignPath(["campaigns"])).toBe(false);
        expect(isApiOnlyCampaignPath(["campaigns", "c1"])).toBe(false);
        expect(isApiOnlyCampaignPath(["campaigns", "c1", "leads"])).toBe(false);
        expect(isApiOnlyCampaignPath(["campaigns", "c1", "sequence", "steps"])).toBe(false);
    });

    it("sends the apps/api-only campaign routes upstream", () => {
        expect(isApiOnlyCampaignPath(["campaigns", "c1", "governance"])).toBe(true);
        expect(isApiOnlyCampaignPath(["campaigns", "c1", "approvals"])).toBe(true);
    });
});

describe("isWebOwnedPath", () => {
    it("keeps smtp connect/test in apps/web but sends smtp domain-checks to apps/api", () => {
        expect(isWebOwnedPath(["integrations", "smtp", "connect"])).toBe(true);
        expect(isWebOwnedPath(["integrations", "smtp", "test"])).toBe(true);
        expect(isWebOwnedPath(["integrations", "smtp", "domain-checks"])).toBe(false);
    });

    describe("settings", () => {
        it("keeps branding and hidden-features web-owned", () => {
            expect(isWebOwnedPath(["settings", "branding"])).toBe(true);
            expect(isWebOwnedPath(["settings", "hidden-features"])).toBe(true);
        });

        it("proxies everything else under settings to apps/api", () => {
            expect(isWebOwnedPath(["settings"])).toBe(false);
            expect(isWebOwnedPath(["settings", "sso"])).toBe(false);
            expect(isWebOwnedPath(["settings", "guardrails"])).toBe(false);
            expect(isWebOwnedPath(["settings", "governance", "analytics"])).toBe(false);
            expect(isWebOwnedPath(["settings", "webhooks", "secret"])).toBe(false);
        });
    });

    describe("email", () => {
        it("keeps the public unsubscribe link web-owned", () => {
            expect(isWebOwnedPath(["email", "unsubscribe", "abc123"])).toBe(true);
        });

        it("proxies send/compose/track/verify to apps/api", () => {
            expect(isWebOwnedPath(["email", "send"])).toBe(false);
            expect(isWebOwnedPath(["email", "compose"])).toBe(false);
            expect(isWebOwnedPath(["email", "track", "open", "abc123"])).toBe(false);
        });
    });

    describe("leads", () => {
        it("keeps list/create, single-lead, and timeline web-owned", () => {
            expect(isWebOwnedPath(["leads"])).toBe(true);
            expect(isWebOwnedPath(["leads", "lead-1"])).toBe(true);
            expect(isWebOwnedPath(["leads", "lead-1", "timeline"])).toBe(true);
        });

        it("proxies bulk/export/import/org-chart to apps/api instead of treating them as a lead id", () => {
            expect(isWebOwnedPath(["leads", "bulk"])).toBe(false);
            expect(isWebOwnedPath(["leads", "export"])).toBe(false);
            expect(isWebOwnedPath(["leads", "import"])).toBe(false);
            expect(isWebOwnedPath(["leads", "org-chart"])).toBe(false);
        });

        it("proxies per-lead action routes apps/web doesn't implement", () => {
            expect(isWebOwnedPath(["leads", "lead-1", "action"])).toBe(false);
            expect(isWebOwnedPath(["leads", "lead-1", "enrich"])).toBe(false);
            expect(isWebOwnedPath(["leads", "lead-1", "identity"])).toBe(false);
            expect(isWebOwnedPath(["leads", "lead-1", "journey"])).toBe(false);
            expect(isWebOwnedPath(["leads", "lead-1", "journey", "suggestions"])).toBe(false);
        });
    });

    describe("workflows", () => {
        it("is never web-owned - the whole builder lives in apps/api", () => {
            expect(isWebOwnedPath(["workflows"])).toBe(false);
            expect(isWebOwnedPath(["workflows", "wf-1"])).toBe(false);
            expect(isWebOwnedPath(["workflows", "wf-1", "run"])).toBe(false);
        });
    });

    it("returns false for unrelated roots (handled by WEB_OWNED_API_ROOTS or the default proxy)", () => {
        expect(isWebOwnedPath(["campaigns", "c-1"])).toBe(false);
    });
});

describe("forwardRequest timeout (roadmap B-05)", () => {
    const originalFetch = global.fetch;

    beforeEach(() => vi.clearAllMocks());
    afterEach(() => { global.fetch = originalFetch; });

    it("aborts the upstream fetch via an AbortSignal", async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(null, { status: 200 })
        );
        global.fetch = fetchMock as any;

        // "workflows" is never web-owned, so this forwards to the upstream API.
        // The proxy reads req.nextUrl, so attach it (NextRequest is type-only here).
        const url = "http://localhost:3000/api/proxy/workflows/wf-1";
        const req = Object.assign(new Request(url, { method: "POST" }), { nextUrl: new URL(url) }) as any;
        await POST(req, { params: Promise.resolve({ path: ["workflows", "wf-1"] }) });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const init = fetchMock.mock.calls[0][1] as RequestInit;
        expect(init.signal).toBeInstanceOf(AbortSignal);
    });

    it("gives the website scan longer than 15s but still bounds other paths at 15s", async () => {
        vi.useFakeTimers();
        try {
            global.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 })) as any;
            const call = async (path: string[]) => {
                const url = `http://localhost:3000/api/proxy/${path.join("/")}`;
                const req = Object.assign(new Request(url, { method: "POST" }), { nextUrl: new URL(url) }) as any;
                await POST(req, { params: Promise.resolve({ path }) });
            };
            // The proxy clears its timer when headers arrive, so capture the timer length instead.
            const spy = vi.spyOn(global, "setTimeout");
            await call(["setup", "scan"]);
            await call(["drip-playbooks", "draft"]);
            await call(["workflows", "wf-1"]);
            const delays = spy.mock.calls.map((c) => c[1]);
            expect(delays.filter((d) => d === 90_000)).toHaveLength(2);
            expect(delays).toContain(15_000);
        } finally {
            vi.useRealTimers();
            vi.restoreAllMocks();
        }
    });
});

describe("forwardRequest upstream failures", () => {
    const originalFetch = global.fetch;

    beforeEach(() => vi.clearAllMocks());
    afterEach(() => { global.fetch = originalFetch; });

    function post() {
        const url = "http://localhost:3000/api/proxy/workflows/wf-1";
        const req = Object.assign(new Request(url, { method: "POST" }), { nextUrl: new URL(url) }) as any;
        return POST(req, { params: Promise.resolve({ path: ["workflows", "wf-1"] }) });
    }

    it("does not tell the browser where the internal API lives when it is unreachable", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        global.fetch = vi.fn().mockRejectedValue(new TypeError("fetch failed")) as any;

        const res = await post();
        const body = await res.json();

        expect(res.status).toBe(502);
        expect(body.code).toBe("PROXY_UPSTREAM_UNAVAILABLE");
        expect(body).not.toHaveProperty("upstream");
        expect(JSON.stringify(body)).not.toMatch(/localhost:3001|127\.0\.0\.1|API_INTERNAL_ORIGIN/);
    });

    it("does not tell the browser where the internal API lives when it times out", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const abort = new Error("aborted");
        abort.name = "AbortError";
        global.fetch = vi.fn().mockRejectedValue(abort) as any;

        const res = await post();
        const body = await res.json();

        expect(res.status).toBe(504);
        expect(body.code).toBe("PROXY_UPSTREAM_TIMEOUT");
        expect(body).not.toHaveProperty("upstream");
    });

    it("logs which request failed and how long it took, without the query string", async () => {
        const log = vi.spyOn(console, "error").mockImplementation(() => {});
        const abort = new Error("aborted");
        abort.name = "AbortError";
        global.fetch = vi.fn().mockRejectedValue(abort) as any;
        const url = "http://localhost:3000/api/proxy/mcp/oauth/consent?code_challenge=secret-value";
        const req = Object.assign(new Request(url, { method: "GET" }), { nextUrl: new URL(url) }) as any;

        await POST(req, { params: Promise.resolve({ path: ["mcp", "oauth", "consent"] }) });

        const entry = log.mock.calls.find(call => call[0] === "[proxy] upstream request failed")?.[1] as Record<string, unknown>;
        expect(entry).toMatchObject({ path: "/api/proxy/mcp/oauth/consent" });
        expect(typeof entry["method"]).toBe("string");
        expect(typeof entry["elapsedMs"]).toBe("number");
        expect(JSON.stringify(entry)).not.toContain("secret-value");
    });

    it("returns a fixed message instead of an internal error's text", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        global.fetch = vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.12:3001")) as any;

        const res = await post();
        const body = await res.json();

        expect(res.status).toBe(502);
        expect(JSON.stringify(body)).not.toContain("10.0.0.12");
    });
});

describe("forwardRequest internal-only routes", () => {
    const originalFetch = global.fetch;

    beforeEach(() => vi.clearAllMocks());
    afterEach(() => { global.fetch = originalFetch; });

    it.each([
        ["email", "send-verification"],
        ["email", "verification-token"],
        ["email", "verify-token"],
        ["email", "verification-token", "extra"],
    ])("does not relay /%s/%s to apps/api", async (...path) => {
        const url = `http://localhost:3000/api/proxy/${path.join("/")}`;
        const req = Object.assign(new Request(url, { method: "POST" }), { nextUrl: new URL(url) }) as any;
        global.fetch = vi.fn() as any;

        const res = await POST(req, { params: Promise.resolve({ path }) });

        expect(res.status).toBe(404);
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it("still relays other email routes", async () => {
        const url = "http://localhost:3000/api/proxy/email/send";
        const req = Object.assign(new Request(url, { method: "POST" }), { nextUrl: new URL(url) }) as any;
        global.fetch = vi.fn().mockResolvedValue(new Response("{}", { status: 200 })) as any;

        const res = await POST(req, { params: Promise.resolve({ path: ["email", "send"] }) });

        expect(res.status).toBe(200);
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });
});
