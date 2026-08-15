import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockGetCurrentContext, mockCreateOrder, mockAuthorizeRole } = vi.hoisted(() => ({
    mockPrisma: {
        plan: { findUnique: vi.fn() },
        team: { update: vi.fn() },
    },
    mockGetCurrentContext: vi.fn(),
    mockCreateOrder: vi.fn(),
    mockAuthorizeRole: vi.fn(),
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

    it("charges the bare plan price with no GST for a non-India customer", async () => {
        mockPrisma.plan.findUnique.mockResolvedValue({ id: "plan-pro", name: "PRO", monthlyPrice: 4900 });

        const { POST } = await import("./route");
        await POST(jsonRequest({ planId: "starter", country: "US" }) as any);

        expect(mockCreateOrder).toHaveBeenCalledWith(
            4900,
            expect.any(String),
            expect.any(String),
            expect.objectContaining({ taxableValue: 4900, taxAmount: 0, taxType: "NONE", taxRate: null })
        );
    });

    it("persists the billing address on the team and clears state for non-India", async () => {
        mockPrisma.plan.findUnique.mockResolvedValue({ id: "plan-pro", name: "PRO", monthlyPrice: 4900 });

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
});
