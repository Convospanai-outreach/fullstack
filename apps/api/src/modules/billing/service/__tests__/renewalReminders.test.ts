import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockSend } = vi.hoisted(() => ({
    mockPrisma: { subscription: { findMany: vi.fn(), updateMany: vi.fn() } },
    mockSend: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/notifications", () => ({ NotificationDispatcher: { send: mockSend } }));

import { renewalReminderText, sendRenewalReminders, yearlySavingPercent } from "../renewalReminders";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-12-10T06:00:00Z");

const sub = (over: Record<string, unknown> = {}) => ({
    id: "sub-1",
    userId: "user-1",
    billingInterval: "MONTH",
    currentPeriodEnd: new Date(now.getTime() + 2 * DAY),
    renewalReminderFor: null,
    plan: { name: "PRO", monthlyPrice: 559900, yearlyPrice: 5309900 },
    ...over,
});

describe("yearlySavingPercent", () => {
    it("is how much a year paid at once saves against twelve monthly payments", () => {
        expect(yearlySavingPercent(559900, 5309900)).toBe(21);
    });
    it("is 0 with no yearly price or no saving", () => {
        expect(yearlySavingPercent(559900, null)).toBe(0);
        expect(yearlySavingPercent(559900, 559900 * 12)).toBe(0);
    });
});

describe("renewalReminderText", () => {
    const base = { planName: "PRO", periodEnd: new Date("2027-01-15T00:00:00Z"), monthlyPrice: 559900, yearlyPrice: 5309900, pricingUrl: "https://app.test/pricing" };

    it("offers a monthly subscriber the yearly price and says what it saves", () => {
        const { title, message } = renewalReminderText({ ...base, billingInterval: "MONTH" });
        expect(title).toContain("15 January 2027");
        expect(message).toContain("https://app.test/pricing");
        expect(message).toContain("Rs.53,099 plus GST instead of Rs.67,188");
        expect(message).toContain("save 21%");
    });

    it("asks a yearly subscriber to renew the year, with the saving against paying monthly", () => {
        const { message } = renewalReminderText({ ...base, billingInterval: "YEAR" });
        expect(message).toContain("another 12 months at Rs.53,099 plus GST");
        expect(message).toContain("21% less than paying monthly");
    });

    it("leaves the offer out when the plan has no yearly price", () => {
        const { message } = renewalReminderText({ ...base, billingInterval: "MONTH", yearlyPrice: null });
        expect(message).not.toContain("Offer");
        expect(message).toContain("Renew before then");
    });
});

describe("sendRenewalReminders", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.subscription.updateMany.mockResolvedValue({ count: 1 });
        mockSend.mockResolvedValue(undefined);
    });

    it("only considers active Razorpay subscriptions of paid plans, since Stripe renews itself", async () => {
        mockPrisma.subscription.findMany.mockResolvedValue([]);
        await sendRenewalReminders(now);
        expect(mockPrisma.subscription.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({ gateway: "RAZORPAY", status: "active", plan: { monthlyPrice: { gt: 0 } } }),
        }));
    });

    it("reminds a monthly subscriber 3 days out, once, and records the period end it reminded for", async () => {
        const due = sub();
        mockPrisma.subscription.findMany.mockResolvedValue([due]);

        expect(await sendRenewalReminders(now)).toBe(1);

        expect(mockPrisma.subscription.updateMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({ id: "sub-1", currentPeriodEnd: due.currentPeriodEnd }),
            data: { renewalReminderFor: due.currentPeriodEnd },
        }));
        expect(mockSend).toHaveBeenCalledWith("user-1", "BILLING", expect.stringContaining("PRO plan ends"), expect.any(String), { kind: "renewal_reminder" });
    });

    it("waits until 3 days out for a monthly subscriber but reminds a yearly one 14 days out", async () => {
        mockPrisma.subscription.findMany.mockResolvedValue([
            sub({ id: "m", currentPeriodEnd: new Date(now.getTime() + 10 * DAY) }),
            sub({ id: "y", billingInterval: "YEAR", currentPeriodEnd: new Date(now.getTime() + 10 * DAY) }),
        ]);

        expect(await sendRenewalReminders(now)).toBe(1);
        expect(mockPrisma.subscription.updateMany).toHaveBeenCalledTimes(1);
        expect(mockPrisma.subscription.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: "y" }) }));
    });

    it("does not remind twice for the same period end, and reminds again once a renewal moves it", async () => {
        const end = new Date(now.getTime() + 2 * DAY);
        mockPrisma.subscription.findMany.mockResolvedValue([sub({ currentPeriodEnd: end, renewalReminderFor: end })]);
        expect(await sendRenewalReminders(now)).toBe(0);

        const later = new Date(end.getTime() + 30 * DAY);
        mockPrisma.subscription.findMany.mockResolvedValue([sub({ currentPeriodEnd: new Date(now.getTime() + 1 * DAY), renewalReminderFor: later })]);
        expect(await sendRenewalReminders(now)).toBe(1);
    });

    it("sends nothing when another worker claimed the reminder first", async () => {
        mockPrisma.subscription.findMany.mockResolvedValue([sub()]);
        mockPrisma.subscription.updateMany.mockResolvedValue({ count: 0 });

        expect(await sendRenewalReminders(now)).toBe(0);
        expect(mockSend).not.toHaveBeenCalled();
    });
});
