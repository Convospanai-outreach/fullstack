import { describe, expect, it } from "vitest";
import worker from "./index";

// The Worker's report-only CSP for a served page. The Meta hosts appear only when the page has a Meta Pixel.
const CONNECTED = "go.brand.test";
const BASE_CSP_RO =
    "default-src 'self'; script-src 'sha256-abc='" +
    " 'strict-dynamic'; style-src 'self' 'unsafe-inline' https:; img-src 'self' https: data:; font-src 'self' https: data:;" +
    " connect-src 'self' https: wss:; frame-src 'self' https:; form-action 'self'; base-uri 'none'; object-src 'none'";

function envWith(kv: Record<string, unknown>) {
    return {
        LANDING_PAGES: { get: async (key: string) => (key in kv ? kv[key] : null) },
        API_ORIGIN: "https://api.test",
        DEFAULT_HOST: "pages.test",
    } as never;
}

async function reportOnlyCsp(page: Record<string, unknown>): Promise<string> {
    const kv = { "page:offer": { html: "<main>Offer</main>", teamId: "team-1", scriptHash: "sha256-abc=", ...page }, [`host:${CONNECTED}`]: "team-1" };
    const res = await worker.fetch(new Request(`https://${CONNECTED}/offer`), envWith(kv));
    return res.headers.get("Content-Security-Policy-Report-Only") ?? "";
}

describe("Worker CSP for Meta Pixel pages", () => {
    it("leaves the policy of a page without a Meta Pixel unchanged", async () => {
        expect(await reportOnlyCsp({ tracking: true })).toBe(BASE_CSP_RO);
        expect(await reportOnlyCsp({ tracking: true, metaPixel: false })).toBe(BASE_CSP_RO);
    });

    it("allows the Meta Pixel loader and beacon hosts only when a Meta Pixel is configured", async () => {
        const csp = await reportOnlyCsp({ tracking: true, metaPixel: true });
        expect(csp).toContain("script-src 'sha256-abc=' 'strict-dynamic' https://connect.facebook.net;");
        expect(csp).toContain("connect-src 'self' https: wss: https://connect.facebook.net https://www.facebook.com;");
        expect(csp).toContain("frame-src 'self' https:;");
        expect(csp.replace(" https://connect.facebook.net", "").replace(" https://www.facebook.com", "")).toBe(BASE_CSP_RO);
    });
});
