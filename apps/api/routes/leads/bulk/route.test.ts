import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockPrisma } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockPrisma: {
        lead: { count: vi.fn(), deleteMany: vi.fn() },
    },
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

import { DELETE } from "./route";

function jsonRequest(body: any) {
    return new Request("http://localhost/leads/bulk", {
        method: "DELETE",
        body: JSON.stringify(body),
    });
}

describe("DELETE /leads/bulk - cross-tenant scoping", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ teamId: "team-1" });
    });

    it("scopes the actual delete mutation to the requesting team, not just the pre-check", async () => {
        mockPrisma.lead.count.mockResolvedValue(2);
        mockPrisma.lead.deleteMany.mockResolvedValue({ count: 2 });

        const res = await DELETE(jsonRequest({ ids: ["lead-1", "lead-2"] }) as any);

        expect(res.status).toBe(200);
        expect(mockPrisma.lead.deleteMany).toHaveBeenCalledWith({
            where: { id: { in: ["lead-1", "lead-2"] }, teamId: "team-1" },
        });
    });

    it("403s and never deletes when an id belongs to a different team", async () => {
        mockPrisma.lead.count.mockResolvedValue(1); // only 1 of 2 ids matched teamId

        const res = await DELETE(jsonRequest({ ids: ["my-lead", "other-teams-lead"] }) as any);

        expect(res.status).toBe(403);
        expect(mockPrisma.lead.deleteMany).not.toHaveBeenCalled();
    });
});
