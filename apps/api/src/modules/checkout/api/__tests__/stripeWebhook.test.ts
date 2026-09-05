import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockTx } = vi.hoisted(() => {
    const mockTx = {
        order: { updateMany: vi.fn(), findUnique: vi.fn() },
        outboxEvent: { create: vi.fn() },
    };
    const mockPrisma = {
        $transaction: vi.fn(),
    };
    return { mockPrisma, mockTx };
});

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

const mockConstructEvent = vi.hoisted(() => vi.fn());
vi.mock("../../gateways/stripeConnect", () => ({
    verifyStripeConnectWebhook: mockConstructEvent,
}));

function webhookRequest(body: string) {
    return new Request("http://localhost/webhooks/stripe-connect", {
        method: "POST",
        headers: { "stripe-signature": "sig_test" },
        body,
    });
}

describe("/webhooks/stripe-connect", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.$transaction.mockImplementation((cb: any) => cb(mockTx));
    });

    it("rejects a request with no stripe-signature header", async () => {
        const { POST } = await import("../stripeWebhook");
        const response = await POST(new Request("http://localhost/webhooks/stripe-connect", { method: "POST", body: "{}" }));
        expect(response.status).toBe(400);
    });

    it("rejects a request whose signature fails verification", async () => {
        mockConstructEvent.mockImplementation(() => { throw new Error("bad signature"); });
        const { POST } = await import("../stripeWebhook");
        const response = await POST(webhookRequest("{}"));
        expect(response.status).toBe(400);
    });

    it("captures the order and publishes ORDER_CAPTURED on checkout.session.completed", async () => {
        mockConstructEvent.mockReturnValue({
            type: "checkout.session.completed",
            account: "acct_seller",
            data: { object: { client_reference_id: "order-1", payment_intent: "pi_1" } },
        });
        mockTx.order.updateMany.mockResolvedValue({ count: 1 });
        mockTx.order.findUnique.mockResolvedValue({
            id: "order-1", teamId: "team-1", productId: "prod-1", customerEmail: "buyer@example.com", amount: 5000,
        });

        const { POST } = await import("../stripeWebhook");
        const response = await POST(webhookRequest("{}"));

        expect(response.status).toBe(200);
        expect(mockTx.order.updateMany).toHaveBeenCalledWith({
            where: { id: "order-1", status: "PENDING", gateway: "STRIPE", gatewayAccountId: "acct_seller" },
            data: { status: "CAPTURED", gatewayPaymentId: "pi_1" },
        });
        expect(mockTx.outboxEvent.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ eventType: "ORDER_CAPTURED", teamId: "team-1", idempotencyKey: "stripe_order_order-1" }),
        }));
    });

    it("does not re-publish when the order is no longer PENDING (retry no-op)", async () => {
        mockConstructEvent.mockReturnValue({
            type: "checkout.session.completed",
            account: "acct_seller",
            data: { object: { client_reference_id: "order-2", payment_intent: "pi_2" } },
        });
        mockTx.order.updateMany.mockResolvedValue({ count: 0 });

        const { POST } = await import("../stripeWebhook");
        const response = await POST(webhookRequest("{}"));

        expect(response.status).toBe(200);
        expect(mockTx.order.findUnique).not.toHaveBeenCalled();
        expect(mockTx.outboxEvent.create).not.toHaveBeenCalled();
    });

    it("never claims an order when the event carries no connected account (cross-tenant capture guard)", async () => {
        mockConstructEvent.mockReturnValue({
            type: "checkout.session.completed",
            data: { object: { client_reference_id: "order-victim", payment_intent: "pi_attacker" } },
        });

        const { POST } = await import("../stripeWebhook");
        const response = await POST(webhookRequest("{}"));

        expect(response.status).toBe(200);
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it("scopes the capture to the connected account the event actually came from", async () => {
        mockConstructEvent.mockReturnValue({
            type: "checkout.session.completed",
            account: "acct_attacker",
            data: { object: { client_reference_id: "order-victim", payment_intent: "pi_attacker" } },
        });
        mockTx.order.updateMany.mockResolvedValue({ count: 0 });

        const { POST } = await import("../stripeWebhook");
        const response = await POST(webhookRequest("{}"));

        expect(response.status).toBe(200);
        expect(mockTx.order.updateMany).toHaveBeenCalledWith({
            where: { id: "order-victim", status: "PENDING", gateway: "STRIPE", gatewayAccountId: "acct_attacker" },
            data: expect.objectContaining({ status: "CAPTURED" }),
        });
        // A victim order's gatewayAccountId is the seller's own account, never
        // the attacker's - so this updateMany matches zero rows and the order
        // is never claimed, exactly like the existing retry no-op path.
        expect(mockTx.order.findUnique).not.toHaveBeenCalled();
        expect(mockTx.outboxEvent.create).not.toHaveBeenCalled();
    });

    it("ignores unrelated event types", async () => {
        mockConstructEvent.mockReturnValue({ type: "payment_intent.created", data: { object: {} } });

        const { POST } = await import("../stripeWebhook");
        const response = await POST(webhookRequest("{}"));

        expect(response.status).toBe(200);
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
});
