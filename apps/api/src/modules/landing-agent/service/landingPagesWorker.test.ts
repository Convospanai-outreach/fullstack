import { describe, expect, it } from "vitest";
// The Cloudflare worker has no test runner of its own; its fetch handler only
// needs Request/Response/Headers, which Node provides, so it is exercised here.
import worker from "../../../../../../workers/landing-pages/src/index";

function makeEnv(stored: Record<string, unknown> | null) {
    return {
        LANDING_PAGES: {
            get: async (key: string) => (key.startsWith("page:") ? stored : null),
        },
        API_ORIGIN: "https://api.example.test",
        DEFAULT_HOST: "pages.example.test",
    } as any;
}

describe("landing-pages worker domain root", () => {
    function makeKv(entries: Record<string, unknown>) {
        return { ...makeEnv(null), LANDING_PAGES: { get: async (key: string) => entries[key] ?? null } } as any;
    }
    const page = { html: "<p>home</p>", teamId: "team-1" };

    it("serves the team's chosen home page at a connected domain's root", async () => {
        const env = makeKv({ "home:go.example.com": "spring", "host:go.example.com": "team-1", "page:spring": page });
        const res = await worker.fetch(new Request("https://go.example.com/"), env);

        expect(res.status).toBe(200);
        expect(await res.text()).toContain("<p>home</p>");
    });

    it("404s at the root when no home page is set", async () => {
        const env = makeKv({ "host:go.example.com": "team-1", "page:spring": page });
        const res = await worker.fetch(new Request("https://go.example.com/"), env);

        expect(res.status).toBe(404);
    });

    it("never serves another team's page as a domain's home page", async () => {
        const env = makeKv({ "home:go.example.com": "spring", "host:go.example.com": "team-2", "page:spring": page });
        const res = await worker.fetch(new Request("https://go.example.com/"), env);

        expect(res.status).toBe(404);
    });

    it("has no home page on our own shared host", async () => {
        const env = makeKv({ "home:pages.example.test": "spring", "page:spring": page });
        const res = await worker.fetch(new Request("https://pages.example.test/"), env);

        expect(res.status).toBe(404);
    });
});

// S-09 (roadmap 3.3): landing pages were served with no CSP / X-Frame-Options.
describe("landing-pages worker security headers", () => {
    it("serves a page with enforced frame-ancestors + XFO and a report-only CSP pinned to the stored script hash", async () => {
        const env = makeEnv({ html: "<!doctype html><p>hi</p>", teamId: "team-1", scriptHash: "sha256-abc123=" });
        const res = await worker.fetch(new Request("https://pages.example.test/my-page"), env);

        expect(res.status).toBe(200);
        expect(res.headers.get("Content-Security-Policy")).toBe("frame-ancestors 'none'");
        expect(res.headers.get("X-Frame-Options")).toBe("DENY");
        const reportOnly = res.headers.get("Content-Security-Policy-Report-Only") ?? "";
        expect(reportOnly).toContain("script-src 'sha256-abc123='");
        expect(reportOnly).toContain("object-src 'none'");
        expect(reportOnly).toContain("base-uri 'none'");
        expect(res.headers.get("Cache-Control")).toBe("public, max-age=60");
        expect(await res.text()).toContain("<p>hi</p>");
    });

    it("falls back to script-src 'none' in report-only for pages pushed before scriptHash existed", async () => {
        const env = makeEnv({ html: "<p>old</p>", teamId: "team-1" });
        const res = await worker.fetch(new Request("https://pages.example.test/old-page"), env);

        expect(res.headers.get("X-Frame-Options")).toBe("DENY");
        expect(res.headers.get("Content-Security-Policy-Report-Only")).toContain("script-src 'none'");
    });

    it("sends the same framing protection on the thank-you page", async () => {
        const res = await worker.fetch(new Request("https://pages.example.test/my-page/thank-you"), makeEnv(null));

        expect(res.headers.get("Content-Security-Policy")).toBe("frame-ancestors 'none'");
        expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    });
});
