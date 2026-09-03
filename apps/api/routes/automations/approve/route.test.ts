import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockPrisma } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockPrisma: {
        automationLog: { findUnique: vi.fn(), updateMany: vi.fn() },
    },
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

import { POST } from "./route";

function jsonRequest(body: any) {
    return new Request("http://localhost", { method: "POST", body: JSON.stringify(body) });
}

describe("POST /automations/approve - cross-tenant scoping", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ teamId: "team-a" });
    });

    it("404s and never updates a log whose automation belongs to another team", async () => {
        mockPrisma.automationLog.findUnique.mockResolvedValue({
            id: "log-1",
            automation: { teamId: "team-b" },
        });

        const res = await POST(jsonRequest({ logId: "log-1" }) as any);

        expect(res.status).toBe(404);
        expect(mockPrisma.automationLog.updateMany).not.toHaveBeenCalled();
    });

    it("scopes the actual update mutation through the automation relation's teamId, not just the pre-check", async () => {
        mockPrisma.automationLog.findUnique
            .mockResolvedValueOnce({ id: "log-1", automation: { teamId: "team-a" } })
            .mockResolvedValueOnce({ id: "log-1", status: "success" });
        mockPrisma.automationLog.updateMany.mockResolvedValue({ count: 1 });

        const res = await POST(jsonRequest({ logId: "log-1" }) as any);

        expect(res.status).toBe(200);
        expect(mockPrisma.automationLog.updateMany).toHaveBeenCalledWith({
            where: { id: "log-1", automation: { teamId: "team-a" } },
            data: expect.objectContaining({ status: "success" }),
        });
    });
});
