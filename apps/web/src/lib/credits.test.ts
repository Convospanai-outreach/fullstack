import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        $transaction: vi.fn(),
        team: { updateMany: vi.fn() },
        creditTransaction: { create: vi.fn() },
    },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

import { deductCredits } from "./credits";

describe("deductCredits - atomic check-and-decrement", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.$transaction.mockImplementation((cb: any) => cb(mockPrisma));
    });

    it("scopes the decrement to rows that still have enough credits, in one atomic updateMany", async () => {
        mockPrisma.team.updateMany.mockResolvedValue({ count: 1 });
        mockPrisma.creditTransaction.create.mockResolvedValue({});

        const result = await deductCredits("team-1", 10, "usage");

        expect(result).toBe(true);
        expect(mockPrisma.team.updateMany).toHaveBeenCalledWith({
            where: { id: "team-1", credits: { gte: 10 } },
            data: { credits: { decrement: 10 } },
        });
    });

    it("returns false and records nothing when the balance is insufficient (updateMany matches no row)", async () => {
        mockPrisma.team.updateMany.mockResolvedValue({ count: 0 });

        const result = await deductCredits("team-1", 10, "usage");

        expect(result).toBe(false);
        expect(mockPrisma.creditTransaction.create).not.toHaveBeenCalled();
    });
});
