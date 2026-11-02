import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: { plan: { updateMany: vi.fn() }, $transaction: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

import { inrMonthlyPaise, refreshInrPlanPrices, roundUpToNinetyNine } from "../inrPricing";

const rateResponse = (body: unknown, ok = true) =>
    ({ ok, status: ok ? 200 : 503, json: async () => body }) as Response;

describe("roundUpToNinetyNine", () => {
    it("rounds up to the next whole-rupee price ending in 99", () => {
        expect(roundUpToNinetyNine(5174)).toBe(5199);
        expect(roundUpToNinetyNine(5554.84)).toBe(5599);
        expect(roundUpToNinetyNine(10454)).toBe(10499);
    });

    it("keeps a price that already ends in 99 and never rounds down", () => {
        expect(roundUpToNinetyNine(5199)).toBe(5199);
        expect(roundUpToNinetyNine(5199.2)).toBe(5299);
        expect(roundUpToNinetyNine(5200)).toBe(5299);
    });
});

describe("inrMonthlyPaise", () => {
    it("converts USD at the rate, adds 20% for India, rounds up and returns paise", () => {
        // $49 x 94.47 x 1.2 = Rs.5,554.84 -> Rs.5,599
        expect(inrMonthlyPaise(4900, 94.47)).toBe(559900);
    });
});

describe("refreshInrPlanPrices", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        mockPrisma.plan.updateMany.mockReset().mockResolvedValue({ count: 1 });
        mockPrisma.$transaction.mockReset().mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops));
    });

    it("writes each paid plan's INR price from the day's USD rate", async () => {
        const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(rateResponse({ rates: { INR: 94.47 } }));

        const result = await refreshInrPlanPrices();

        expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("base=USD&symbols=INR"), expect.anything());
        expect(result.rate).toBe(94.47);
        expect(mockPrisma.plan.updateMany).toHaveBeenCalledTimes(3);
        expect(mockPrisma.plan.updateMany).toHaveBeenCalledWith({ where: { name: "PRO" }, data: { monthlyPrice: 559900 } });
        expect(mockPrisma.plan.updateMany).toHaveBeenCalledWith({ where: { name: "GROWTH" }, data: { monthlyPrice: 1129900 } });
        expect(mockPrisma.plan.updateMany).toHaveBeenCalledWith({ where: { name: "ENTERPRISE" }, data: { monthlyPrice: 5659900 } });
    });

    it("writes all plan prices in one transaction", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(rateResponse({ rates: { INR: 94.47 } }));

        await refreshInrPlanPrices();

        expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
        expect(mockPrisma.$transaction.mock.calls[0][0]).toHaveLength(3);
    });

    it("keeps the current prices when the rate source fails", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(rateResponse({}, false));

        await expect(refreshInrPlanPrices()).rejects.toThrow();
        expect(mockPrisma.plan.updateMany).not.toHaveBeenCalled();
    });

    it("keeps the current prices when the rate is missing or implausible", async () => {
        for (const body of [{}, { rates: { INR: 0 } }, { rates: { INR: 9447 } }, { rates: { INR: "94.47" } }]) {
            vi.spyOn(globalThis, "fetch").mockResolvedValue(rateResponse(body));
            await expect(refreshInrPlanPrices()).rejects.toThrow();
        }
        expect(mockPrisma.plan.updateMany).not.toHaveBeenCalled();
    });
});
