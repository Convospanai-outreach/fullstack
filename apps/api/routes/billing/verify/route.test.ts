import { beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "crypto";

const { mockPrisma, mockTx, mockGetCurrentContext, mockOrdersFetch } = vi.hoisted(() => {
    const mockTx = {
        team: { update: vi.fn() },
        creditTransaction: { create: vi.fn() },
        invoice: { create: vi.fn() },
        outboxEvent: { create: vi.fn() },
    };
    const mockPrisma = {
        creditTransaction: { findFirst: vi.fn() },
        invoice: { findFirst: vi.fn() },
        outboxEvent: { create: vi.fn(), findUnique: vi.fn() },
        $transaction: vi.fn(),
    };
    return { mockPrisma, mockTx, mockGetCurrentContext: vi.fn(), mockOrdersFetch: vi.fn() };
});

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/razorpay", () => ({
    razorpay: { orders: { fetch: mockOrdersFetch } },
    isRazorpayConfigured: true,
}));

const KEY_SECRET = "test_key_secret";

function signedBody(orderId: string, paymentId: string) {
    const signature = crypto.createHmac("sha256", KEY_SECRET).update(`${orderId}|${paymentId}`).digest("hex");
    return { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature };
}

function jsonRequest(body: any) {
    return new Request("http://localhost/billing/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
    });
}

describe("/billing/verify", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env["RAZORPAY_KEY_SECRET"] = KEY_SECRET;
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockPrisma.creditTransaction.findFirst.mockResolvedValue(null);
        mockPrisma.invoice.findFirst.mockResolvedValue(null);
        mockPrisma.$transaction.mockImplementation((cb: any) => cb(mockTx));
        mockTx.team.update.mockResolvedValue({});
        mockTx.creditTransaction.create.mockResolvedValue({});
        mockTx.invoice.create.mockResolvedValue({});
        mockOrdersFetch.mockResolvedValue({
            amount: 50000,
            currency: "INR",
            notes: { teamId: "team-1", type: "topup", credits: "500" },
        });
    });

    it("401s when there is no session", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: null, teamId: null });
        const { POST } = await import("./route");
        const response = await POST(jsonRequest(signedBody("order_1", "pay_1")) as any);
        expect(response.status).toBe(401);
    });

    it("rejects a forged signature with 400", async () => {
        const { POST } = await import("./route");
        const response = await POST(jsonRequest({
            razorpay_order_id: "order_1",
            razorpay_payment_id: "pay_1",
            razorpay_signature: "not-the-real-signature",
        }) as any);

        expect(response.status).toBe(400);
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it("rejects an order that belongs to a different team", async () => {
        mockOrdersFetch.mockResolvedValue({
            amount: 50000,
            currency: "INR",
            notes: { teamId: "team-OTHER", type: "topup", credits: "500" },
        });

        const { POST } = await import("./route");
        const response = await POST(jsonRequest(signedBody("order_1", "pay_1")) as any);

        expect(response.status).toBe(403);
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it("grants credits idempotently on a valid signature", async () => {
        const { POST } = await import("./route");
        const response = await POST(jsonRequest(signedBody("order_1", "pay_1")) as any);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toMatchObject({ status: "ok", credits: 500 });
        expect(mockTx.team.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: "team-1" },
            data: { credits: { increment: 500 } },
        }));
        expect(mockTx.creditTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ paymentId: "pay_1" }),
        }));
    });

    it("is a no-op when the webhook already credited this payment first", async () => {
        mockPrisma.creditTransaction.findFirst.mockResolvedValue({ id: "existing" });

        const { POST } = await import("./route");
        const response = await POST(jsonRequest(signedBody("order_1", "pay_1")) as any);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toMatchObject({ status: "ok", alreadyCredited: true });
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
});
