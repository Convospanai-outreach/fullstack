import { beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "crypto";

const { mockPrisma, mockAddCredits } = vi.hoisted(() => ({
    mockPrisma: {
        creditTransaction: {
            findFirst: vi.fn(),
        },
        plan: {
            findUnique: vi.fn(),
        },
        subscription: {
            upsert: vi.fn(),
        },
    },
    mockAddCredits: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/credits", () => ({ addCredits: mockAddCredits }));

const WEBHOOK_SECRET = "test_webhook_secret";

function signedRequest(body: any) {
    const rawBody = JSON.stringify(body);
    const signature = crypto.createHmac("sha256", WEBHOOK_SECRET).update(rawBody).digest("hex");
    return new Request("http://localhost/webhooks/razorpay", {
        method: "POST",
        headers: { "x-razorpay-signature": signature, "content-type": "application/json" },
        body: rawBody,
    });
}

describe("/webhooks/razorpay", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env["RAZORPAY_WEBHOOK_SECRET"] = WEBHOOK_SECRET;
        mockPrisma.creditTransaction.findFirst.mockResolvedValue(null);
    });

    it("rejects a mismatched-length signature with 400 instead of throwing", async () => {
        const { POST } = await import("./route");
        const rawBody = JSON.stringify({
            event: "payment.captured",
            payload: { payment: { entity: { id: "pay_1", order_id: "order_1", amount: 1000, notes: {} } } },
        });

        const response = await POST(new Request("http://localhost/webhooks/razorpay", {
            method: "POST",
            headers: { "x-razorpay-signature": "short", "content-type": "application/json" },
            body: rawBody,
        }) as any);

        expect(response.status).toBe(400);
        expect(mockAddCredits).not.toHaveBeenCalled();
    });

    it("grants the plan's monthly credits and upserts a Subscription on a captured subscription payment", async () => {
        mockPrisma.plan.findUnique.mockResolvedValue({ id: "plan-growth", name: "GROWTH", creditsPerMonth: 2500 });

        const { POST } = await import("./route");
        const response = await POST(signedRequest({
            event: "payment.captured",
            payload: {
                payment: {
                    entity: {
                        id: "pay_123",
                        order_id: "order_123",
                        amount: 9900,
                        notes: { teamId: "team-1", userId: "user-1", planId: "plan-growth" },
                    },
                },
            },
        }) as any);

        expect(response.status).toBe(200);
        expect(mockPrisma.subscription.upsert).toHaveBeenCalledWith(expect.objectContaining({
            where: { userId: "user-1" },
            create: expect.objectContaining({ userId: "user-1", planId: "plan-growth", status: "active" }),
        }));
        expect(mockAddCredits).toHaveBeenCalledWith(
            "team-1",
            2500,
            expect.stringContaining("GROWTH"),
            expect.objectContaining({ paymentId: "pay_123" }),
            "subscription"
        );
    });

    it("does not grant credits twice for a retried webhook delivery of the same payment", async () => {
        mockPrisma.creditTransaction.findFirst.mockResolvedValue({ id: "existing-tx" });

        const { POST } = await import("./route");
        const response = await POST(signedRequest({
            event: "payment.captured",
            payload: {
                payment: {
                    entity: {
                        id: "pay_dup",
                        order_id: "order_dup",
                        amount: 50000,
                        notes: { teamId: "team-1", type: "topup", credits: "500" },
                    },
                },
            },
        }) as any);

        expect(response.status).toBe(200);
        expect(mockAddCredits).not.toHaveBeenCalled();
    });

    it("ignores a subscription payment whose planId does not match a known plan", async () => {
        mockPrisma.plan.findUnique.mockResolvedValue(null);

        const { POST } = await import("./route");
        const response = await POST(signedRequest({
            event: "payment.captured",
            payload: {
                payment: {
                    entity: {
                        id: "pay_bad_plan",
                        order_id: "order_bad_plan",
                        amount: 9900,
                        notes: { teamId: "team-1", userId: "user-1", planId: "does-not-exist" },
                    },
                },
            },
        }) as any);

        expect(response.status).toBe(200);
        expect(mockPrisma.subscription.upsert).not.toHaveBeenCalled();
        expect(mockAddCredits).not.toHaveBeenCalled();
    });
});
