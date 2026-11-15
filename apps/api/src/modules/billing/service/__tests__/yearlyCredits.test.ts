import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockTx, mockAddCredits } = vi.hoisted(() => {
    const mockTx = { subscription: { updateMany: vi.fn() } };
    return {
        mockTx,
        mockPrisma: { subscription: { findMany: vi.fn() }, $transaction: vi.fn() },
        mockAddCredits: vi.fn(),
    };
});

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/credits", () => ({ addCredits: mockAddCredits }));

import { grantDueYearlyCredits } from "../yearlyCredits";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-12-10T00:00:00Z");

const subscription = (over: Record<string, unknown> = {}) => ({
    id: "sub-1",
    teamId: "team-1",
    currentPeriodEnd: new Date(now.getTime() + 300 * DAY),
    nextCreditGrantAt: new Date(now.getTime() - 1000),
    plan: { name: "PRO", creditsPerMonth: 500 },
    ...over,
});

describe("grantDueYearlyCredits", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.$transaction.mockImplementation((cb: any) => cb(mockTx));
        mockTx.subscription.updateMany.mockResolvedValue({ count: 1 });
        mockAddCredits.mockResolvedValue({ granted: true });
    });

    it("only looks at active yearly subscriptions that are due and still inside the paid year", async () => {
        mockPrisma.subscription.findMany.mockResolvedValue([]);

        await grantDueYearlyCredits(now);

        expect(mockPrisma.subscription.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: {
                billingInterval: "YEAR",
                status: "active",
                nextCreditGrantAt: { lte: now },
                currentPeriodEnd: { gt: now },
                teamId: { not: null },
            },
        }));
    });

    it("credits one month, with a payment id unique to that due date, and moves the next grant 30 days on", async () => {
        const due = subscription();
        mockPrisma.subscription.findMany.mockResolvedValue([due]);

        const granted = await grantDueYearlyCredits(now);

        expect(granted).toBe(1);
        expect(mockTx.subscription.updateMany).toHaveBeenCalledWith({
            where: { id: "sub-1", billingInterval: "YEAR", status: "active", nextCreditGrantAt: due.nextCreditGrantAt },
            data: { nextCreditGrantAt: new Date(due.nextCreditGrantAt.getTime() + 30 * DAY) },
        });
        expect(mockAddCredits).toHaveBeenCalledWith(
            "team-1", 500, expect.stringContaining("yearly subscription"),
            { paymentId: `yearly_sub-1_${due.nextCreditGrantAt.toISOString()}` }, "subscription", mockTx
        );
    });

    it("makes the last grant of the year and then schedules none", async () => {
        const due = subscription({ currentPeriodEnd: new Date(now.getTime() + 10 * DAY) });
        mockPrisma.subscription.findMany.mockResolvedValue([due]);

        await grantDueYearlyCredits(now);

        expect(mockTx.subscription.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { nextCreditGrantAt: null } }));
        expect(mockAddCredits).toHaveBeenCalledTimes(1);
    });

    it("grants nothing when another worker already claimed this grant, so running twice never double-credits", async () => {
        mockPrisma.subscription.findMany.mockResolvedValue([subscription()]);
        mockTx.subscription.updateMany.mockResolvedValue({ count: 0 });

        expect(await grantDueYearlyCredits(now)).toBe(0);
        expect(mockAddCredits).not.toHaveBeenCalled();
    });

    it("treats a duplicate payment id as an already-made grant and carries on with the next subscription", async () => {
        mockPrisma.subscription.findMany.mockResolvedValue([subscription(), subscription({ id: "sub-2", teamId: "team-2" })]);
        mockAddCredits.mockRejectedValueOnce(Object.assign(new Error("unique"), { code: "P2002" })).mockResolvedValueOnce({ granted: true });

        expect(await grantDueYearlyCredits(now)).toBe(1);
        expect(mockAddCredits).toHaveBeenCalledTimes(2);
    });

    it("lets any other failure through, so the sweep reports it", async () => {
        mockPrisma.subscription.findMany.mockResolvedValue([subscription()]);
        mockAddCredits.mockRejectedValue(new Error("db down"));

        await expect(grantDueYearlyCredits(now)).rejects.toThrow("db down");
    });
});
