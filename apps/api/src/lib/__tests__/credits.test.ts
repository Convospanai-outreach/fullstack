import { describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        $transaction: vi.fn(),
        team: { update: vi.fn(), updateMany: vi.fn() },
        creditTransaction: { create: vi.fn() },
    },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

describe("addCredits", () => {
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
});
