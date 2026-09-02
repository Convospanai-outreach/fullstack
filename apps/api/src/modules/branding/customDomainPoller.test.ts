import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockGetCustomHostnameStatus } = vi.hoisted(() => ({
    mockPrisma: {
        customDomain: { findMany: vi.fn(), update: vi.fn() },
    },
    mockGetCustomHostnameStatus: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));
vi.mock("./cloudflareCustomHostnameService", () => ({ getCustomHostnameStatus: mockGetCustomHostnameStatus }));

import { pollPendingCustomDomains } from "./customDomainPoller";

describe("pollPendingCustomDomains", () => {
    const originalEnv = { ...process.env };
    const originalFetch = global.fetch;

    beforeEach(() => {
        vi.clearAllMocks();
        process.env["CLOUDFLARE_ACCOUNT_ID"] = "acct-1";
        process.env["CLOUDFLARE_API_TOKEN"] = "token-1";
        process.env["CLOUDFLARE_KV_NAMESPACE_ID"] = "ns-1";
    });

    afterEach(() => {
        process.env = { ...originalEnv };
        global.fetch = originalFetch;
    });

    it("leaves a still-pending domain pending but records the check time", async () => {
        mockPrisma.customDomain.findMany.mockResolvedValue([
            { id: "cd-1", domain: "go.example.com", teamId: "team-1", cloudflareHostnameId: "cf-1" },
        ]);
        mockGetCustomHostnameStatus.mockResolvedValue({ status: "pending" });

        const results = await pollPendingCustomDomains();

        expect(results).toEqual([]);
        expect(mockPrisma.customDomain.update).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: "cd-1" }, data: expect.objectContaining({ lastCheckedAt: expect.any(Date) }) })
        );
    });

    it("on activation, writes host->teamId into the landing-pages KV namespace and flips status to active", async () => {
        mockPrisma.customDomain.findMany.mockResolvedValue([
            { id: "cd-1", domain: "go.example.com", teamId: "team-1", cloudflareHostnameId: "cf-1" },
        ]);
        mockGetCustomHostnameStatus.mockResolvedValue({ status: "active" });
        const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => "" });
        global.fetch = fetchMock as any;

        const results = await pollPendingCustomDomains();

        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringContaining("/values/host:go.example.com"),
            expect.objectContaining({ method: "PUT", body: "team-1" })
        );
        expect(mockPrisma.customDomain.update).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: "cd-1" }, data: expect.objectContaining({ status: "active" }) })
        );
        expect(results).toEqual([{ domain: "go.example.com", status: "active" }]);
    });

    it("flips to invalid on a terminal verification failure", async () => {
        mockPrisma.customDomain.findMany.mockResolvedValue([
            { id: "cd-1", domain: "go.example.com", teamId: "team-1", cloudflareHostnameId: "cf-1" },
        ]);
        mockGetCustomHostnameStatus.mockResolvedValue({ status: "invalid", verificationErrors: ["blocked"] });

        const results = await pollPendingCustomDomains();

        expect(mockPrisma.customDomain.update).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ status: "invalid" }) })
        );
        expect(results).toEqual([{ domain: "go.example.com", status: "invalid" }]);
    });
});
