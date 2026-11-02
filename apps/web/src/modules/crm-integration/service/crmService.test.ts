import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        lead: { findFirst: vi.fn(), update: vi.fn() },
        crmIntegration: { findUnique: vi.fn(), update: vi.fn() },
    },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), error: vi.fn() } }));
vi.mock("@hubspot/api-client", () => ({ Client: vi.fn() }));

import { Client } from "@hubspot/api-client";
import { crmService } from "./crmService";
import { decryptCrmToken, encryptCrmToken } from "./crmSecrets";

describe("crmService.syncLead - cross-tenant scoping", () => {
    beforeEach(() => vi.clearAllMocks());

    it("refuses to sync a lead that doesn't belong to the given team (cross-tenant IDOR)", async () => {
        // findFirst scoped to {id, teamId} finds nothing when leadId belongs to another team.
        mockPrisma.lead.findFirst.mockResolvedValue(null);
        mockPrisma.crmIntegration.findUnique.mockResolvedValue({ isActive: true, accessToken: "token" });

        const result = await crmService.syncLead("lead-from-team-b", "team-a");

        expect(mockPrisma.lead.findFirst).toHaveBeenCalledWith({ where: { id: "lead-from-team-b", teamId: "team-a" } });
        expect(result).toEqual({ status: "error", details: "Lead not found" });
    });
});

describe("crmService.syncLead - token encryption", () => {
    const lead = { id: "lead-1", teamId: "team-a", email: "a@example.com", company: null, jobTitle: null, fullName: null };

    beforeEach(() => {
        vi.clearAllMocks();
        process.env["ENCRYPTION_KEY"] = "a".repeat(64);
        process.env["HUBSPOT_CLIENT_ID"] = "client-id";
        process.env["HUBSPOT_CLIENT_SECRET"] = "client-secret";
        mockPrisma.lead.findFirst.mockResolvedValue(lead);
        vi.mocked(Client).mockImplementation(function () {
            return {
                crm: {
                    contacts: {
                        searchApi: { doSearch: vi.fn().mockResolvedValue({ results: [{ id: "c1" }] }) },
                        basicApi: { update: vi.fn().mockResolvedValue({}), create: vi.fn() },
                    },
                },
            };
        } as any);
    });

    it("hands HubSpot the decrypted access token, not the stored ciphertext", async () => {
        mockPrisma.crmIntegration.findUnique.mockResolvedValue({
            isActive: true,
            accessToken: encryptCrmToken("plain-access"),
            refreshToken: null,
            expiresAt: null,
        });

        await crmService.syncLead("lead-1", "team-a");

        expect(Client).toHaveBeenCalledWith({ accessToken: "plain-access" });
    });

    it("refreshes with the decrypted refresh token and stores the new tokens encrypted", async () => {
        mockPrisma.crmIntegration.findUnique.mockResolvedValue({
            isActive: true,
            accessToken: encryptCrmToken("old-access"),
            refreshToken: encryptCrmToken("old-refresh"),
            expiresAt: new Date(Date.now() - 60_000),
        });
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ access_token: "new-access", refresh_token: "new-refresh", expires_in: 1800 }),
        });
        vi.stubGlobal("fetch", fetchMock);

        await crmService.syncLead("lead-1", "team-a");

        expect(new URLSearchParams(fetchMock.mock.calls[0][1].body).get("refresh_token")).toBe("old-refresh");
        const written = mockPrisma.crmIntegration.update.mock.calls[0][0].data;
        expect(written.accessToken).not.toContain("new-access");
        expect(written.refreshToken).not.toContain("new-refresh");
        expect(decryptCrmToken(written.accessToken)).toBe("new-access");
        expect(decryptCrmToken(written.refreshToken)).toBe("new-refresh");
        expect(Client).toHaveBeenCalledWith({ accessToken: "new-access" });
        vi.unstubAllGlobals();
    });

    it("re-stores a legacy plaintext refresh token encrypted when HubSpot omits a new one", async () => {
        mockPrisma.crmIntegration.findUnique.mockResolvedValue({
            isActive: true,
            accessToken: encryptCrmToken("old-access"),
            refreshToken: "legacy-plain-refresh",
            expiresAt: new Date(Date.now() - 60_000),
        });
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ access_token: "new-access", expires_in: 1800 }),
        }));

        await crmService.syncLead("lead-1", "team-a");

        const written = mockPrisma.crmIntegration.update.mock.calls[0][0].data;
        expect(written.refreshToken).not.toContain("legacy-plain-refresh");
        expect(decryptCrmToken(written.refreshToken)).toBe("legacy-plain-refresh");
        vi.unstubAllGlobals();
    });
});
