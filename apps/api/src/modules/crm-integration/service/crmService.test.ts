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

import { crmService } from "./crmService";

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
