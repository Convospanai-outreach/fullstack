import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockClientCtor, mockSearch, mockCreate } = vi.hoisted(() => ({
    mockPrisma: {
        lead: { findFirst: vi.fn(), update: vi.fn() },
        crmIntegration: { findUnique: vi.fn(), update: vi.fn() },
    },
    mockClientCtor: vi.fn(),
    mockSearch: vi.fn(),
    mockCreate: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), error: vi.fn() } }));
vi.mock("@hubspot/api-client", () => ({
    Client: mockClientCtor.mockImplementation(function MockHubspotClient() {
        return {
            crm: {
                contacts: {
                    searchApi: { doSearch: mockSearch },
                    basicApi: { create: mockCreate, update: vi.fn() },
                },
            },
        };
    }),
}));

import { crmService } from "./crmService";
import { encryptCrmToken } from "./crmSecrets";

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
    beforeEach(() => {
        vi.clearAllMocks();
        process.env["ENCRYPTION_KEY"] = "a".repeat(64);
    });

    it("decrypts the stored access token before constructing the HubSpot client", async () => {
        mockPrisma.lead.findFirst.mockResolvedValue({
            id: "lead-1",
            email: "a@b.com",
            company: null,
            jobTitle: null,
            fullName: null,
        });
        mockPrisma.crmIntegration.findUnique.mockResolvedValue({
            isActive: true,
            accessToken: encryptCrmToken("real-access-token"),
            refreshToken: null,
            expiresAt: null,
            fieldMapping: null,
        });
        mockSearch.mockResolvedValue({ results: [] });
        mockCreate.mockResolvedValue({ id: "hs-1" });
        mockPrisma.lead.update.mockResolvedValue({});

        const result = await crmService.syncLead("lead-1", "team-a");

        expect(mockClientCtor).toHaveBeenCalledWith({ accessToken: "real-access-token" });
        expect(result).toEqual({ status: "success", crmId: "hs-1" });
    });
});
