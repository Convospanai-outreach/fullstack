import { describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({ mockPrisma: { plan: { findMany: vi.fn() } } }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

const PLAN = { id: "p1", name: "PRO", monthlyPrice: 559900, yearlyPrice: 5289900, creditsPerMonth: 500, maxAgents: 5, features: {}, stripePrices: null };

describe("/billing/plans", () => {
    it("marks INR plans available so the pricing page shows the Indian price", async () => {
        mockPrisma.plan.findMany.mockResolvedValue([PLAN]);
        const { GET } = await import("./route");
        const body = await (await GET(new Request("http://localhost/billing/plans?country=IN"))).json();
        expect(body.currency).toBe("INR");
        expect(body.plans[0]).toMatchObject({ amount: 559900, yearlyAmount: 5289900, available: true });
    });

    it("marks a USD plan unavailable when it has no Stripe price", async () => {
        mockPrisma.plan.findMany.mockResolvedValue([PLAN]);
        const { GET } = await import("./route");
        const body = await (await GET(new Request("http://localhost/billing/plans?country=US"))).json();
        expect(body.plans[0]).toMatchObject({ amount: null, available: false });
    });
});
