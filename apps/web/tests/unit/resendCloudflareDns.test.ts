import type { Resend } from "resend";
import { afterEach, describe, expect, it, vi } from "vitest";
import { configureResendCloudflareDns } from "@/lib/resendCloudflareDns";

const zoneId = "0123456789abcdef0123456789abcdef";
const token = "zone-token";
const senderDomain = "example.test";
const apiResponse = (result: unknown) => Response.json({ success: true, result });

function fixture(status: "pending" | "verified" = "pending") {
    const domain = {
        id: "domain-1", status, capabilities: { sending: "enabled" },
        records: [{ record: "DKIM", type: "TXT", name: "resend._domainkey", value: "p=publickey", status }],
    };
    const resend = { domains: {
        list: vi.fn().mockResolvedValue({ data: { data: [{ id: domain.id, name: senderDomain }], has_more: false } }),
        get: vi.fn().mockResolvedValue({ data: domain }),
        create: vi.fn(),
        verify: vi.fn().mockResolvedValue({ data: { id: domain.id } }),
    } };
    const run = (inboundDomain?: string) => configureResendCloudflareDns({ resend: resend as unknown as Resend, zoneId, token, senderDomain, inboundDomain });
    const fetch = vi.fn().mockResolvedValueOnce(apiResponse({ name: senderDomain, status: "active" }));
    vi.stubGlobal("fetch", fetch);
    return { run, fetch, resend };
}

afterEach(() => vi.unstubAllGlobals());

describe("Resend Cloudflare DNS setup", () => {
    it("adds missing DNS records and requests provider verification", async () => {
        const { run, fetch, resend } = fixture();
        fetch.mockResolvedValueOnce(apiResponse([])).mockResolvedValueOnce(apiResponse({ id: "record" }));

        await expect(run()).resolves.toEqual([{ domain: senderDomain, ready: false }]);
        expect(fetch).toHaveBeenLastCalledWith(expect.stringMatching(/\/dns_records$/), expect.objectContaining({
            method: "POST", body: JSON.stringify({ type: "TXT", name: "resend._domainkey.example.test", content: "p=publickey", ttl: 1 }),
        }));
        expect(resend.domains.verify).toHaveBeenCalledWith("domain-1");
    });

    it("reuses an existing verified record when setup is retried", async () => {
        const { run, fetch, resend } = fixture("verified");
        fetch.mockResolvedValueOnce(apiResponse([{ type: "TXT", name: "resend._domainkey.example.test", content: '"p=publickey"' }]));

        await expect(run()).resolves.toEqual([{ domain: senderDomain, ready: true }]);
        expect(fetch.mock.calls.every((call) => call[1].method === "GET")).toBe(true);
        expect(resend.domains.verify).not.toHaveBeenCalled();
    });

    it("refuses to overwrite a conflicting DNS record", async () => {
        const { run, fetch, resend } = fixture();
        fetch.mockResolvedValueOnce(apiResponse([{ type: "TXT", name: "resend._domainkey.example.test", content: "p=other" }]));

        await expect(run()).rejects.toThrow("already exists");
        expect(fetch.mock.calls.every((call) => call[1].method === "GET")).toBe(true);
        expect(resend.domains.verify).not.toHaveBeenCalled();
    });

    it("rejects receiving at the zone apex before changing either provider", async () => {
        const { run, fetch, resend } = fixture();
        await expect(run(senderDomain)).rejects.toThrow("separate receiving subdomain");
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(resend.domains.list).not.toHaveBeenCalled();
    });

    it("adds the receiving MX only to the dedicated reply subdomain", async () => {
        const { run, fetch, resend } = fixture("verified");
        fetch.mockResolvedValueOnce(apiResponse([{ type: "TXT", name: "resend._domainkey.example.test", content: "p=publickey" }]))
            .mockResolvedValueOnce(apiResponse([])).mockResolvedValueOnce(apiResponse({ id: "receiving-mx" }));
        resend.domains.create.mockResolvedValue({ data: {
            id: "inbound-1", status: "not_started", capabilities: { receiving: "enabled" },
            records: [{ record: "Receiving", type: "MX", name: "@", value: "inbound.example.test", priority: 10, status: "pending" }],
        } });

        await expect(run("reply.example.test")).resolves.toEqual([
            { domain: senderDomain, ready: true }, { domain: "reply.example.test", ready: false },
        ]);
        expect(resend.domains.create).toHaveBeenCalledWith({ name: "reply.example.test", capabilities: { sending: "disabled", receiving: "enabled" } });
        expect(fetch).toHaveBeenLastCalledWith(expect.stringMatching(/\/dns_records$/), expect.objectContaining({
            method: "POST", body: JSON.stringify({ type: "MX", name: "reply.example.test", content: "inbound.example.test", priority: 10, ttl: 1 }),
        }));
    });
});
