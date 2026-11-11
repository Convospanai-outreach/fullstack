import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DECAP_SCRIPT } from "@/lib/decapCms";

import { GET as page } from "./route";
import { GET as config } from "./config.yml/route";

function get(url: string, headers: Record<string, string> = {}) {
    return new Request(url, { headers });
}

describe("GET /cms", () => {
    beforeEach(() => vi.stubEnv("NEXTAUTH_URL", "https://www.example.com"));
    afterEach(() => vi.unstubAllEnvs());

    it("serves the admin page: the pinned Decap script with its integrity hash, and this site's config", async () => {
        const res = await page(get("https://www.example.com/cms", { host: "www.example.com" }));
        const html = await res.text();

        expect(res.status).toBe(200);
        expect(res.headers.get("content-type")).toContain("text/html");
        expect(html).toContain(`src="${DECAP_SCRIPT.src}"`);
        expect(html).toContain(`integrity="${DECAP_SCRIPT.integrity}"`);
        expect(html).toContain('href="/cms/config.yml"');
        expect(res.headers.get("cache-control")).toContain("no-store");
        expect(res.headers.get("x-robots-tag")).toContain("noindex");
    });

    it("sends a visitor on another hostname to the configured one, which the GitHub login is registered for", async () => {
        const res = await page(get("https://example.com/cms", { host: "example.com" }));

        expect(res.status).toBe(308);
        expect(res.headers.get("location")).toBe("https://www.example.com/cms");
    });
});

describe("GET /cms/config.yml", () => {
    beforeEach(() => vi.stubEnv("NEXTAUTH_URL", "https://www.example.com"));
    afterEach(() => vi.unstubAllEnvs());

    it("serves the config with the site's own address as the login base", async () => {
        const res = await config(get("https://www.example.com/cms/config.yml"));
        const text = await res.text();

        expect(res.status).toBe(200);
        expect(res.headers.get("content-type")).toContain("yaml");
        expect(text).toContain("base_url: https://www.example.com");
        expect(res.headers.get("cache-control")).toContain("no-store");
    });
});
