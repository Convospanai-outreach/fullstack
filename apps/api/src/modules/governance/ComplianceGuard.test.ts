import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        lead: { update: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
        suppressionEntry: { upsert: vi.fn() },
        auditLog: { create: vi.fn() },
    },
}));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

import { complianceGuard } from "./ComplianceGuard";

beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.lead.updateMany.mockResolvedValue({ count: 0 });
});

describe("ComplianceGuard.enforceOptOut", () => {
    it("marks the lead DNC and also suppresses its address for the lead's own team", async () => {
        mockPrisma.lead.findUnique.mockResolvedValue({ id: "l1", teamId: "t1", email: "Person@Example.com" });

        await complianceGuard.enforceOptOut("l1", "Instagram flow: the person asked to stop");

        expect(mockPrisma.lead.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "DNC" }) }));
        expect(mockPrisma.suppressionEntry.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { teamId_email: { teamId: "t1", email: "person@example.com" } },
                create: expect.objectContaining({ teamId: "t1", email: "person@example.com", reason: "OPT_OUT", leadId: "l1" }),
            }),
        );
    });

    it("does not suppress when the lead has no email", async () => {
        mockPrisma.lead.findUnique.mockResolvedValue({ id: "l1", teamId: "t1", email: null });

        await complianceGuard.enforceOptOut("l1", "stop");

        expect(mockPrisma.suppressionEntry.upsert).not.toHaveBeenCalled();
    });
});
