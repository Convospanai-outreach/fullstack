import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockGetCurrentContext, mockAuthorizeRole, mockRecordLeadDataSources } = vi.hoisted(() => ({
    mockPrisma: {
        lead: { findFirst: vi.fn(), updateMany: vi.fn() },
    },
    mockGetCurrentContext: vi.fn(),
    mockAuthorizeRole: vi.fn(),
    mockRecordLeadDataSources: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/permissions", () => ({
    authorizeRole: mockAuthorizeRole,
    TeamRole: { MEMBER: "MEMBER" },
}));
vi.mock("@/lib/crm/leadDataSource", () => ({ recordLeadDataSources: mockRecordLeadDataSources }));

import { PATCH } from "./route";

function patchRequest(body: any) {
    return new Request("http://localhost/leads/lead-1", { method: "PATCH", body: JSON.stringify(body) });
}

describe("PATCH /leads/[id]", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ teamId: "team-1", userId: "user-1" });
        mockAuthorizeRole.mockResolvedValue(undefined);
    });

    it("records a MANUAL provenance row for each field that actually changed", async () => {
        mockPrisma.lead.findFirst
            .mockResolvedValueOnce({ id: "lead-1", company: "Old Co", domain: null })
            .mockResolvedValueOnce({ id: "lead-1", company: "New Co", domain: "new.example" });
        mockPrisma.lead.updateMany.mockResolvedValue({ count: 1 });

        await PATCH(patchRequest({ company: "New Co", domain: "new.example" }), { params: Promise.resolve({ id: "lead-1" }) });

        expect(mockRecordLeadDataSources).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({ leadId: "lead-1", field: "company", source: "MANUAL", value: "New Co" }),
                expect.objectContaining({ leadId: "lead-1", field: "domain", source: "MANUAL", value: "new.example" }),
            ])
        );
    });

    it("does not record provenance for a field that was submitted but didn't actually change", async () => {
        mockPrisma.lead.findFirst
            .mockResolvedValueOnce({ id: "lead-1", company: "Same Co" })
            .mockResolvedValueOnce({ id: "lead-1", company: "Same Co" });
        mockPrisma.lead.updateMany.mockResolvedValue({ count: 1 });

        await PATCH(patchRequest({ company: "Same Co" }), { params: Promise.resolve({ id: "lead-1" }) });

        expect(mockRecordLeadDataSources).not.toHaveBeenCalled();
    });

    it("silently drops fields outside the allowlist without recording provenance for them", async () => {
        mockPrisma.lead.findFirst
            .mockResolvedValueOnce({ id: "lead-1", company: "Old Co" })
            .mockResolvedValueOnce({ id: "lead-1", company: "New Co" });
        mockPrisma.lead.updateMany.mockResolvedValue({ count: 1 });

        await PATCH(patchRequest({ company: "New Co", intentScore: 0.99 }), { params: Promise.resolve({ id: "lead-1" }) });

        expect(mockPrisma.lead.updateMany).toHaveBeenCalledWith({
            where: { id: "lead-1", teamId: "team-1" },
            data: { company: "New Co" },
        });
    });
});
