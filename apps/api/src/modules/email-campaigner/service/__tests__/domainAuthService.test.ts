import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockResolveMx, mockResolveTxt, mockUpsert, mockFindFirst } = vi.hoisted(() => ({
    mockResolveMx: vi.fn(),
    mockResolveTxt: vi.fn(),
    mockUpsert: vi.fn(),
    mockFindFirst: vi.fn(),
}));

vi.mock("dns/promises", () => ({ resolveMx: mockResolveMx, resolveTxt: mockResolveTxt }));
vi.mock("@/lib/db", () => ({
    prisma: {
        domainAuthenticationCheck: { upsert: mockUpsert },
        connectedMailbox: { findFirst: mockFindFirst },
    },
}));

import { checkDomainDeliverabilitySignals, checkGoogleWorkspaceDomainAuth } from "../domainAuthService";

describe("checkDomainDeliverabilitySignals", () => {
    beforeEach(() => vi.clearAllMocks());

    it("reports every record verified when MX, SPF, DMARC, and a common DKIM selector are all present", async () => {
        mockResolveMx.mockResolvedValueOnce([{ exchange: "mx.example.com", priority: 10 }]);
        mockResolveTxt.mockImplementation(async (host: string) => {
            if (host === "example.com") return [["v=spf1 include:_spf.google.com ~all"]];
            if (host === "_dmarc.example.com") return [["v=DMARC1; p=reject"]];
            if (host === "google._domainkey.example.com") return [["v=DKIM1; k=rsa; p=abc123"]];
            throw Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" });
        });

        const result = await checkDomainDeliverabilitySignals("example.com");

        expect(result).toEqual({ domain: "example.com", mx: true, spf: true, dmarc: true, dkim: true });
    });

    it("reports everything missing for a domain with no DNS records at all", async () => {
        mockResolveMx.mockRejectedValue(Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" }));
        mockResolveTxt.mockRejectedValue(Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" }));

        const result = await checkDomainDeliverabilitySignals("nodns.example");

        expect(result).toEqual({ domain: "nodns.example", mx: false, spf: false, dmarc: false, dkim: false });
    });

    it("rejects an invalid domain before making any DNS query", async () => {
        await expect(checkDomainDeliverabilitySignals("not a domain")).rejects.toThrow(
            "Enter a valid domain, such as example.com."
        );
        expect(mockResolveMx).not.toHaveBeenCalled();
    });
});

describe("checkGoogleWorkspaceDomainAuth", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUpsert.mockResolvedValue({});
        mockResolveMx.mockRejectedValue(Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" }));
        mockResolveTxt.mockRejectedValue(Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" }));
    });

    // Regression test for a schema-drift bug: DomainAuthenticationCheck's @@unique
    // constraint was renamed from [teamId, domain] to [teamId, domain, provider]
    // when Resend domain verification was added, but this upsert kept using the
    // old compound-key name (teamId_domain), which compiled fine under `prisma as
    // any` but threw a Prisma validation error on every call in production.
    it("upserts on the current teamId_domain_provider compound key, scoped to the GOOGLE_WORKSPACE provider", async () => {
        await checkGoogleWorkspaceDomainAuth({ teamId: "team-1", domain: "example.com" });

        expect(mockUpsert).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    teamId_domain_provider: { teamId: "team-1", domain: "example.com", provider: "GOOGLE_WORKSPACE" },
                },
                create: expect.objectContaining({ provider: "GOOGLE_WORKSPACE" }),
            }),
        );
    });
});
