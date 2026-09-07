import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        iCP: {
            findFirst: vi.fn(),
            updateMany: vi.fn(),
            deleteMany: vi.fn(),
        },
    },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

import { icpService } from "./icpService";

describe("icpService - cross-tenant scoping (OPEN-227)", () => {
    beforeEach(() => vi.clearAllMocks());

    describe("update", () => {
        it("scopes the actual update by teamId, not just a pre-check", async () => {
            mockPrisma.iCP.updateMany.mockResolvedValue({ count: 1 });
            mockPrisma.iCP.findFirst.mockResolvedValue({ id: "icp-1", teamId: "team-a", name: "Updated" });

            await icpService.update("team-a", "icp-1", { name: "Updated" });

            expect(mockPrisma.iCP.updateMany).toHaveBeenCalledWith({
                where: { id: "icp-1", teamId: "team-a" },
                data: { name: "Updated" },
            });
        });

        it("refuses to update an ICP belonging to a different team (cross-tenant IDOR)", async () => {
            mockPrisma.iCP.updateMany.mockResolvedValue({ count: 0 });

            const result = await icpService.update("team-a", "icp-from-team-b", { name: "Hijacked" });

            expect(result).toBeNull();
            expect(mockPrisma.iCP.findFirst).not.toHaveBeenCalled();
        });
    });

    describe("delete", () => {
        it("scopes the actual delete by teamId, not just a pre-check", async () => {
            mockPrisma.iCP.deleteMany.mockResolvedValue({ count: 1 });

            const result = await icpService.delete("team-a", "icp-1");

            expect(result).toBe(true);
            expect(mockPrisma.iCP.deleteMany).toHaveBeenCalledWith({
                where: { id: "icp-1", teamId: "team-a" },
            });
        });

        it("refuses to delete an ICP belonging to a different team (cross-tenant IDOR)", async () => {
            mockPrisma.iCP.deleteMany.mockResolvedValue({ count: 0 });

            const result = await icpService.delete("team-a", "icp-from-team-b");

            expect(result).toBe(false);
        });
    });
});
