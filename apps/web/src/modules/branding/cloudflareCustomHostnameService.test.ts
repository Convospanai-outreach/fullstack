import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { removeCustomHostname, setDomainHomePage } from "./cloudflareCustomHostnameService";

const KV = "https://api.cloudflare.com/client/v4/accounts/acct-1/storage/kv/namespaces/ns-1/values/";

describe("cloudflareCustomHostnameService (apps/web)", () => {
    const originalEnv = { ...process.env };
    const originalFetch = global.fetch;
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        process.env["CLOUDFLARE_ZONE_ID"] = "zone-1";
        process.env["CLOUDFLARE_API_TOKEN"] = "token-1";
        process.env["CLOUDFLARE_ACCOUNT_ID"] = "acct-1";
        process.env["CLOUDFLARE_KV_NAMESPACE_ID"] = "ns-1";
        fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
        global.fetch = fetchMock as any;
    });

    afterEach(() => {
        process.env = { ...originalEnv };
        global.fetch = originalFetch;
    });

    const calls = () => fetchMock.mock.calls.map(([url, init]) => `${init.method} ${url}`);

    it("writes the home page slug under the domain's home: key", async () => {
        await setDomainHomePage("go.example.com", "spring");

        expect(calls()).toEqual([`PUT ${KV}home%3Ago.example.com`]);
        expect(fetchMock.mock.calls[0]![1].body).toBe("spring");
    });

    it("deletes the home: key when the home page is cleared", async () => {
        await setDomainHomePage("go.example.com", null);

        expect(calls()).toEqual([`DELETE ${KV}home%3Ago.example.com`]);
    });

    it("removes the Cloudflare hostname and both of the domain's KV entries on disconnect", async () => {
        await removeCustomHostname("go.example.com", "cf-1");

        expect(calls()).toEqual([
            "DELETE https://api.cloudflare.com/client/v4/zones/zone-1/custom_hostnames/cf-1",
            `DELETE ${KV}host%3Ago.example.com`,
            `DELETE ${KV}home%3Ago.example.com`,
        ]);
    });

    it("treats entries that are already gone as removed", async () => {
        fetchMock.mockResolvedValue({ ok: false, status: 404 });

        await expect(removeCustomHostname("go.example.com", "cf-1")).resolves.toBeUndefined();
    });

    it("fails instead of leaving the ownership entry behind when Cloudflare errors", async () => {
        fetchMock.mockResolvedValue({ ok: false, status: 500 });

        await expect(removeCustomHostname("go.example.com", null)).rejects.toThrow("host:go.example.com");
    });

    it("refuses to run without the KV configuration", async () => {
        delete process.env["CLOUDFLARE_KV_NAMESPACE_ID"];

        await expect(setDomainHomePage("go.example.com", "spring")).rejects.toThrow("not configured");
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
