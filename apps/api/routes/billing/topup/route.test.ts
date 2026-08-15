import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockGetCurrentContext, mockCreateTopUpOrder } = vi.hoisted(() => ({
    mockPrisma: {
        team: { update: vi.fn() },
    },
    mockGetCurrentContext: vi.fn(),
    mockCreateTopUpOrder: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
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

    it("passes the tier's paise amount unchanged and stamps userId/country/state through", async () => {
        const { POST } = await import("./route");
        const response = await POST(jsonRequest({ tierId: "starter", country: "IN", state: "Karnataka" }) as any);

        expect(response.status).toBe(200);
        expect(mockCreateTopUpOrder).toHaveBeenCalledWith("team-1", "user-1", 50000, 500, "IN", "Karnataka");
    });

    it("400s for an unknown tier", async () => {
        const { POST } = await import("./route");
        const response = await POST(jsonRequest({ tierId: "bogus", country: "IN", state: "Delhi" }) as any);
        expect(response.status).toBe(400);
        expect(mockCreateTopUpOrder).not.toHaveBeenCalled();
    });
});
