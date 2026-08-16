import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        $transaction: vi.fn(),
        team: { update: vi.fn(), updateMany: vi.fn() },
        creditTransaction: { create: vi.fn() },
    },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

describe("addCredits", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("grants credits and reports granted: true on success", async () => {
        mockPrisma.$transaction.mockResolvedValue([{}, {}]);

        const { addCredits } = await import("@/lib/credits");
        const result = await addCredits("team-1", 500, "Top-up", { paymentId: "pay_1" }, "topup");

        expect(result).toEqual({ granted: true });
    });

    it("reports granted: false instead of throwing when the paymentId unique constraint rejects a duplicate", async () => {
        const conflict = Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
        mockPrisma.$transaction.mockRejectedValue(conflict);

        const { addCredits } = await import("@/lib/credits");
        const result = await addCredits("team-1", 500, "Top-up", { paymentId: "pay_1" }, "topup");

        expect(result).toEqual({ granted: false });
    });

    it("re-throws errors that are not a unique-constraint conflict", async () => {
        mockPrisma.$transaction.mockRejectedValue(new Error("connection lost"));

        const { addCredits } = await import("@/lib/credits");
        await expect(addCredits("team-1", 500, "Top-up", { paymentId: "pay_1" }, "topup")).rejects.toThrow("connection lost");
    });

    it("runs directly on a caller-provided tx instead of opening its own transaction", async () => {
        const tx = { team: { update: vi.fn().mockResolvedValue({}) }, creditTransaction: { create: vi.fn().mockResolvedValue({}) } };

        const { addCredits } = await import("@/lib/credits");
        const result = await addCredits("team-1", 500, "Top-up", { paymentId: "pay_1" }, "topup", tx as any);

        expect(result).toEqual({ granted: true });
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
        expect(tx.team.update).toHaveBeenCalledWith({ where: { id: "team-1" }, data: { credits: { increment: 500 } } });
        expect(tx.creditTransaction.create).toHaveBeenCalled();
    });

    it("propagates a paymentId conflict instead of swallowing it when tx is provided, so the caller's own transaction rolls back", async () => {
        const conflict = Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
        const tx = { team: { update: vi.fn().mockResolvedValue({}) }, creditTransaction: { create: vi.fn().mockRejectedValue(conflict) } };

        const { addCredits } = await import("@/lib/credits");
        await expect(addCredits("team-1", 500, "Top-up", { paymentId: "pay_1" }, "topup", tx as any)).rejects.toBe(conflict);
    });
});
