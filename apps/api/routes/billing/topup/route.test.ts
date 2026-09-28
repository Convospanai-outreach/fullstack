import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockGetCurrentContext, mockCreateTopUpOrder, mockAuthorizeRole } = vi.hoisted(() => ({
    mockPrisma: {
        team: { update: vi.fn() },
    },
    mockGetCurrentContext: vi.fn(),
    mockCreateTopUpOrder: vi.fn(),
    mockAuthorizeRole: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/permissions", () => ({
    TeamRole: { ADMIN: "admin" },
    authorizeRole: mockAuthorizeRole,
}));
vi.mock("@/modules/billing/service/billingService", () => ({
    billingService: { createTopUpOrder: mockCreateTopUpOrder },
}));

function jsonRequest(body: any) {
    return new Request("http://localhost/billing/topup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
    });
}

describe("/billing/topup", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockAuthorizeRole.mockResolvedValue(undefined);
        mockPrisma.team.update.mockResolvedValue({});
        mockCreateTopUpOrder.mockResolvedValue({ id: "order_1", amount: 50000, currency: "INR" });
    });

    it("rejects when billing country is missing", async () => {
        const { POST } = await import("./route");
        const response = await POST(jsonRequest({ tierId: "starter" }) as any);
        expect(response.status).toBe(400);
        expect(mockCreateTopUpOrder).not.toHaveBeenCalled();
    });

    it("rejects an India billing address without a state", async () => {
        const { POST } = await import("./route");
        const response = await POST(jsonRequest({ tierId: "starter", country: "IN" }) as any);
        expect(response.status).toBe(400);
        expect(mockCreateTopUpOrder).not.toHaveBeenCalled();
    });

    it("adds IGST on top of the tier's paise amount and requires ADMIN", async () => {
        const { POST } = await import("./route");
        const response = await POST(jsonRequest({ tierId: "starter", country: "IN", state: "Karnataka" }) as any);

        expect(response.status).toBe(200);
        expect(mockAuthorizeRole).toHaveBeenCalledWith("user-1", "team-1", "admin");
        expect(mockCreateTopUpOrder).toHaveBeenCalledWith(
            "team-1",
            "user-1",
            59000, // 50000 + 18% IGST
            500,
            "IN",
            "Karnataka",
            { taxableValue: 50000, taxAmount: 9000, taxType: "IGST", taxRate: 18, totalAmount: 59000 }
        );
    });

    it("does not create an order when the caller is not ADMIN", async () => {
        mockAuthorizeRole.mockRejectedValue(new Error("Forbidden"));

        const { POST } = await import("./route");
        await expect(POST(jsonRequest({ tierId: "starter", country: "IN", state: "Karnataka" }) as any)).rejects.toThrow("Forbidden");

        expect(mockCreateTopUpOrder).not.toHaveBeenCalled();
    });

    it("treats a lowercase country code as India", async () => {
        const { POST } = await import("./route");
        const response = await POST(jsonRequest({ tierId: "starter", country: "in", state: "Karnataka" }) as any);

        expect(response.status).toBe(200);
        expect(mockCreateTopUpOrder).toHaveBeenCalledWith(
            "team-1",
            "user-1",
            59000,
            500,
            "IN",
            "Karnataka",
            { taxableValue: 50000, taxAmount: 9000, taxType: "IGST", taxRate: 18, totalAmount: 59000 }
        );
    });

    it("charges the bare tier amount with no GST for a non-India customer", async () => {
        const { POST } = await import("./route");
        await POST(jsonRequest({ tierId: "starter", country: "US" }) as any);

        expect(mockCreateTopUpOrder).toHaveBeenCalledWith(
            "team-1",
            "user-1",
            50000,
            500,
            "US",
            undefined,
            { taxableValue: 50000, taxAmount: 0, taxType: "NONE", taxRate: null, totalAmount: 50000 }
        );
    });

    it("400s for an unknown tier", async () => {
        const { POST } = await import("./route");
        const response = await POST(jsonRequest({ tierId: "bogus", country: "IN", state: "Delhi" }) as any);
        expect(response.status).toBe(400);
        expect(mockCreateTopUpOrder).not.toHaveBeenCalled();
    });

    it("does not persist the billing address when order creation fails", async () => {
        mockCreateTopUpOrder.mockRejectedValue(new Error("Razorpay unavailable"));

        const { POST } = await import("./route");
        const response = await POST(jsonRequest({ tierId: "starter", country: "IN", state: "Karnataka" }) as any);

        expect(response.status).toBe(500);
        expect(mockPrisma.team.update).not.toHaveBeenCalled();
    });

    it("persists the billing address only after the order is successfully created", async () => {
        const calls: string[] = [];
        mockCreateTopUpOrder.mockImplementation(async () => {
            calls.push("createTopUpOrder");
            return { id: "order_1", amount: 59000, currency: "INR" };
        });
        mockPrisma.team.update.mockImplementation(async () => {
            calls.push("team.update");
            return {};
        });

        const { POST } = await import("./route");
        await POST(jsonRequest({ tierId: "starter", country: "IN", state: "Karnataka" }) as any);

        expect(calls).toEqual(["createTopUpOrder", "team.update"]);
    });
});
