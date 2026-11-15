import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockGetCurrentContext, mockCreateOrder, mockAuthorizeRole, mockCreateSubscriptionCheckoutSession } = vi.hoisted(() => ({
    mockPrisma: {
        plan: { findUnique: vi.fn() },
        team: { update: vi.fn() },
    },
    mockGetCurrentContext: vi.fn(),
    mockCreateOrder: vi.fn(),
    mockAuthorizeRole: vi.fn(),
    mockCreateSubscriptionCheckoutSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/permissions", () => ({
    TeamRole: { ADMIN: "admin" },
    authorizeRole: mockAuthorizeRole,
}));
vi.mock("@/modules/billing/service/billingService", () => ({
    billingService: { createOrder: mockCreateOrder },
}));
vi.mock("@/modules/billing/service/stripeSubscriptionGateway", () => ({
    createSubscriptionCheckoutSession: mockCreateSubscriptionCheckoutSession,
}));

function jsonRequest(body: any) {
    return new Request("http://localhost/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
    });
}

describe("/billing/checkout", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockAuthorizeRole.mockResolvedValue(undefined);
        mockPrisma.team.update.mockResolvedValue({});
        mockCreateOrder.mockResolvedValue({ id: "order_1", amount: 4900, currency: "USD" });
    });

    it("rejects when billing country is missing", async () => {
        const { POST } = await import("./route");
        const response = await POST(jsonRequest({ planId: "starter" }) as any);
        expect(response.status).toBe(400);
        expect(mockCreateOrder).not.toHaveBeenCalled();
    });

    it("rejects an India billing address without a state", async () => {
        const { POST } = await import("./route");
        const response = await POST(jsonRequest({ planId: "starter", country: "IN" }) as any);
        expect(response.status).toBe(400);
        expect(mockCreateOrder).not.toHaveBeenCalled();
    });

    it("resolves the Growth plan alias, adds GST on top for a Delhi customer, and requires ADMIN", async () => {
        mockPrisma.plan.findUnique.mockResolvedValue({ id: "plan-growth", name: "GROWTH", monthlyPrice: 9900 });

        const { POST } = await import("./route");
        const response = await POST(jsonRequest({ planId: "growth", country: "IN", state: "Delhi" }) as any);

        expect(response.status).toBe(200);
        expect(mockAuthorizeRole).toHaveBeenCalledWith("user-1", "team-1", "admin");
        expect(mockPrisma.plan.findUnique).toHaveBeenCalledWith({ where: { name: "GROWTH" } });
        expect(mockCreateOrder).toHaveBeenCalledWith(
            11682, // 9900 + 18% GST, added on top
            expect.any(String),
            expect.any(String),
            expect.objectContaining({
                userId: "user-1",
                teamId: "team-1",
                planId: "plan-growth",
                country: "IN",
                state: "Delhi",
                taxableValue: 9900,
                taxAmount: 1782,
                taxType: "CGST_SGST",
                taxRate: 18,
            })
        );
    });

    it("does not create an order when the caller is not ADMIN", async () => {
        mockAuthorizeRole.mockRejectedValue(new Error("Forbidden"));
        mockPrisma.plan.findUnique.mockResolvedValue({ id: "plan-growth", name: "GROWTH", monthlyPrice: 9900 });

        const { POST } = await import("./route");
        const response = await POST(jsonRequest({ planId: "growth", country: "IN", state: "Delhi" }) as any);

        expect(response.status).toBe(500);
        expect(mockCreateOrder).not.toHaveBeenCalled();
    });

    it("treats a lowercase country code as India", async () => {
        mockPrisma.plan.findUnique.mockResolvedValue({ id: "plan-growth", name: "GROWTH", monthlyPrice: 9900 });

        const { POST } = await import("./route");
        const response = await POST(jsonRequest({ planId: "growth", country: "in", state: "Delhi" }) as any);

        expect(response.status).toBe(200);
        expect(mockCreateOrder).toHaveBeenCalledWith(
            11682,
            expect.any(String),
            expect.any(String),
            expect.objectContaining({ country: "IN", state: "Delhi", taxType: "CGST_SGST" })
        );
    });

    it("routes a non-India customer to Stripe checkout using the plan's USD price, skipping GST", async () => {
        mockPrisma.plan.findUnique.mockResolvedValue({
            id: "plan-pro",
            name: "PRO",
            monthlyPrice: 4900,
            stripePrices: { USD: { amount: 2900, stripePriceId: "price_pro_usd" } },
        });
        mockCreateSubscriptionCheckoutSession.mockResolvedValue({ url: "https://checkout.stripe.com/session_1", sessionId: "cs_1" });

        const { POST } = await import("./route");
        const response = await POST(jsonRequest({ planId: "starter", country: "US" }) as any);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({ gateway: "STRIPE", url: "https://checkout.stripe.com/session_1" });
        expect(mockCreateSubscriptionCheckoutSession).toHaveBeenCalledWith(
            expect.objectContaining({ stripePriceId: "price_pro_usd", teamId: "team-1", userId: "user-1", planId: "plan-pro" })
        );
        expect(mockCreateOrder).not.toHaveBeenCalled();
    });

    it("charges the yearly INR price plus GST for a yearly order and records the interval in the order notes", async () => {
        mockPrisma.plan.findUnique.mockResolvedValue({ id: "plan-pro", name: "PRO", monthlyPrice: 559900, yearlyPrice: 5309900 });

        const { POST } = await import("./route");
        const response = await POST(jsonRequest({ planId: "pro", country: "IN", state: "Delhi", interval: "year" }) as any);

        expect(response.status).toBe(200);
        expect(mockCreateOrder).toHaveBeenCalledWith(
            6265682, // 5309900 + 18% GST
            expect.any(String),
            expect.any(String),
            expect.objectContaining({ interval: "year", taxableValue: 5309900, taxAmount: 955782 })
        );
    });

    it("keeps an order with no interval monthly", async () => {
        mockPrisma.plan.findUnique.mockResolvedValue({ id: "plan-pro", name: "PRO", monthlyPrice: 559900, yearlyPrice: 5309900 });

        const { POST } = await import("./route");
        await POST(jsonRequest({ planId: "pro", country: "IN", state: "Delhi" }) as any);

        expect(mockCreateOrder).toHaveBeenCalledWith(
            expect.any(Number), expect.any(String), expect.any(String),
            expect.objectContaining({ interval: "month", taxableValue: 559900 })
        );
    });

    it("400s a yearly order for a plan with no yearly price, and for a yearly order without a plan", async () => {
        mockPrisma.plan.findUnique.mockResolvedValue({ id: "plan-pro", name: "PRO", monthlyPrice: 559900, yearlyPrice: null });

        const { POST } = await import("./route");
        const noYearly = await POST(jsonRequest({ planId: "pro", country: "IN", state: "Delhi", interval: "year" }) as any);
        const noPlan = await POST(jsonRequest({ priceId: "price_pro_monthly", country: "IN", state: "Delhi", interval: "year" }) as any);

        expect(noYearly.status).toBe(400);
        expect(noPlan.status).toBe(400);
        expect(mockCreateOrder).not.toHaveBeenCalled();
    });

    it("sends a non-India yearly order to the plan's yearly Stripe price, and 400s when none is set", async () => {
        mockPrisma.plan.findUnique.mockResolvedValue({
            id: "plan-pro", name: "PRO", monthlyPrice: 4900,
            stripePrices: { USD: { amount: 4900, stripePriceId: "price_pro_usd", yearly: { amount: 46800, stripePriceId: "price_pro_usd_year" } } },
        });
        mockCreateSubscriptionCheckoutSession.mockResolvedValue({ url: "https://checkout.stripe.com/session_y", sessionId: "cs_y" });

        const { POST } = await import("./route");
        const ok = await POST(jsonRequest({ planId: "pro", country: "US", interval: "year" }) as any);
        expect(ok.status).toBe(200);
        expect(mockCreateSubscriptionCheckoutSession).toHaveBeenCalledWith(
            expect.objectContaining({ stripePriceId: "price_pro_usd_year", interval: "year" })
        );

        mockCreateSubscriptionCheckoutSession.mockClear();
        mockPrisma.plan.findUnique.mockResolvedValue({
            id: "plan-pro", name: "PRO", monthlyPrice: 4900,
            stripePrices: { USD: { amount: 4900, stripePriceId: "price_pro_usd" } },
        });
        const missing = await POST(jsonRequest({ planId: "pro", country: "US", interval: "year" }) as any);
        expect(missing.status).toBe(400);
        expect(mockCreateSubscriptionCheckoutSession).not.toHaveBeenCalled();
    });

    it("400s when the plan has no Stripe price for the customer's currency", async () => {
        mockPrisma.plan.findUnique.mockResolvedValue({ id: "plan-pro", name: "PRO", monthlyPrice: 4900, stripePrices: null });

        const { POST } = await import("./route");
        const response = await POST(jsonRequest({ planId: "starter", country: "US" }) as any);

        expect(response.status).toBe(400);
        expect(mockCreateOrder).not.toHaveBeenCalled();
        expect(mockCreateSubscriptionCheckoutSession).not.toHaveBeenCalled();
    });

    it("persists the billing address on the team and clears state for non-India", async () => {
        mockPrisma.plan.findUnique.mockResolvedValue({
            id: "plan-pro",
            name: "PRO",
            monthlyPrice: 4900,
            stripePrices: { USD: { amount: 2900, stripePriceId: "price_pro_usd" } },
        });
        mockCreateSubscriptionCheckoutSession.mockResolvedValue({ url: "https://checkout.stripe.com/session_1", sessionId: "cs_1" });

        const { POST } = await import("./route");
        await POST(jsonRequest({ planId: "starter", country: "US" }) as any);

        expect(mockPrisma.team.update).toHaveBeenCalledWith({
            where: { id: "team-1" },
            data: { billingCountry: "US", billingState: null },
        });
    });

    it("400s for an unknown plan alias", async () => {
        mockPrisma.plan.findUnique.mockResolvedValue(null);

        const { POST } = await import("./route");
        const response = await POST(jsonRequest({ planId: "nonexistent", country: "IN", state: "Delhi" }) as any);

        expect(response.status).toBe(400);
        expect(mockCreateOrder).not.toHaveBeenCalled();
    });

    // roadmap 3.3 (S-10): a non-string priceId used to throw on
    // `priceId.includes(...)` and come back as a 500.
    it("400s a non-string priceId instead of crashing", async () => {
        const { POST } = await import("./route");
        const response = await POST(jsonRequest({ priceId: 42, country: "US" }) as any);

        expect(response.status).toBe(400);
        expect((await response.json()).code).toBe("VALIDATION_ERROR");
        expect(mockPrisma.team.update).not.toHaveBeenCalled();
        expect(mockCreateOrder).not.toHaveBeenCalled();
    });
});
