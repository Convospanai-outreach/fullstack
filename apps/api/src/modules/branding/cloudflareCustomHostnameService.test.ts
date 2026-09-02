import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));

import { createCustomHostname, getCustomHostnameStatus } from "./cloudflareCustomHostnameService";

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

    it("returns null when Cloudflare isn't configured, without calling fetch", async () => {
        delete process.env["CLOUDFLARE_ZONE_ID"];
        const fetchMock = vi.fn();
        global.fetch = fetchMock as any;

        const result = await createCustomHostname("go.example.com");

        expect(result).toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("creates a custom hostname with TXT validation and returns the ownership record", async () => {
        global.fetch = vi.fn().mockResolvedValue(
            jsonResponse({
                result: {
                    id: "cf-hostname-1",
                    ownership_verification: { type: "txt", name: "_cf-custom-hostname.go.example.com", value: "abc123" },
                },
            })
        ) as any;

        const result = await createCustomHostname("go.example.com");

        expect(result).toEqual({
            cloudflareHostnameId: "cf-hostname-1",
            ownershipVerification: { name: "_cf-custom-hostname.go.example.com", value: "abc123" },
        });
    });

    it("throws when Cloudflare rejects the hostname", async () => {
        global.fetch = vi.fn().mockResolvedValue(jsonResponse({ errors: [{ message: "invalid hostname" }] }, false, 400)) as any;

        await expect(createCustomHostname("not a domain")).rejects.toThrow("invalid hostname");
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
