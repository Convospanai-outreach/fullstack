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

import { checkGoogleWorkspaceDomainAuth } from "../domainAuthService";

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
