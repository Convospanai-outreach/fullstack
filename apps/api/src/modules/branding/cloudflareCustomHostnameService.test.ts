import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getCustomHostnameStatus } from "./cloudflareCustomHostnameService";

function jsonResponse(body: unknown, ok = true, status = 200) {
    return { ok, status, json: async () => body } as Response;
}

describe("cloudflareCustomHostnameService", () => {
    const originalEnv = { ...process.env };
    const originalFetch = global.fetch;

    beforeEach(() => {
        vi.clearAllMocks();
        process.env["CLOUDFLARE_ZONE_ID"] = "zone-1";
        process.env["CLOUDFLARE_API_TOKEN"] = "token-1";
    });

    afterEach(() => {
        process.env = { ...originalEnv };
        global.fetch = originalFetch;
    });

    it("reports active only when both hostname and SSL status are active", async () => {
        global.fetch = vi.fn().mockResolvedValue(
            jsonResponse({ result: { status: "active", ssl: { status: "pending" } } })
        ) as any;

        const result = await getCustomHostnameStatus("cf-hostname-1");

        expect(result.status).toBe("pending");
    });

    it("reports active once both hostname and SSL are active", async () => {
        global.fetch = vi.fn().mockResolvedValue(
            jsonResponse({ result: { status: "active", ssl: { status: "active" } } })
        ) as any;

        const result = await getCustomHostnameStatus("cf-hostname-1");

        expect(result.status).toBe("active");
    });

    it("reports invalid on a terminal Cloudflare failure status", async () => {
        global.fetch = vi.fn().mockResolvedValue(
            jsonResponse({ result: { status: "blocked", ssl: { status: "pending" }, verification_errors: ["blocked"] } })
        ) as any;

        const result = await getCustomHostnameStatus("cf-hostname-1");

        expect(result.status).toBe("invalid");
    });
});
