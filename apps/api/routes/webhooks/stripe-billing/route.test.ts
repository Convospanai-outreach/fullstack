import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockTx } = vi.hoisted(() => {
    const mockTx = {
        team: { update: vi.fn() },
        creditTransaction: { create: vi.fn() },
        invoice: { create: vi.fn() },
        outboxEvent: { create: vi.fn() },
        $queryRaw: vi.fn(),
    };
    const mockPrisma = {
        creditTransaction: { findFirst: vi.fn() },
        invoice: { findFirst: vi.fn() },
        plan: { findUnique: vi.fn() },
        $transaction: vi.fn(),
    };
    return { mockPrisma, mockTx };
});

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

const { mockVerifyWebhook, mockGetSubscriptionMetadata } = vi.hoisted(() => ({
    mockVerifyWebhook: vi.fn(),
    mockGetSubscriptionMetadata: vi.fn(),
}));
vi.mock("@/modules/billing/service/stripeSubscriptionGateway", () => ({
    verifyStripeBillingWebhook: mockVerifyWebhook,
    getSubscriptionMetadata: mockGetSubscriptionMetadata,
}));

function webhookRequest(body: string) {
    return new Request("http://localhost/webhooks/stripe-billing", {
        method: "POST",
        headers: { "stripe-signature": "sig_test" },
        body,
    });
}

function invoiceEvent(overrides: Record<string, any> = {}) {
    return {
        type: "invoice.payment_succeeded",
        data: {
            object: {
                id: "in_1",
                subscription: "sub_1",
                amount_paid: 2900,
                currency: "usd",
                created: 1700000000,
                ...overrides,
            },
        },
    };
}

describe("/webhooks/stripe-billing", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.creditTransaction.findFirst.mockResolvedValue(null);
        mockPrisma.invoice.findFirst.mockResolvedValue(null);
        mockPrisma.$transaction.mockImplementation((cb: any) => cb(mockTx));
        mockTx.team.update.mockResolvedValue({});
        mockTx.creditTransaction.create.mockResolvedValue({});
        mockTx.invoice.create.mockResolvedValue({});
        mockTx.$queryRaw.mockResolvedValue([{ id: "sub-1" }]);
        mockGetSubscriptionMetadata.mockResolvedValue({ teamId: "team-1", userId: "user-1", planId: "plan-1" });
        mockPrisma.plan.findUnique.mockResolvedValue({ id: "plan-1", name: "PRO", creditsPerMonth: 500 });
    });

    it("rejects a request with no stripe-signature header", async () => {
        const { POST } = await import("./route");
        const response = await POST(new Request("http://localhost/webhooks/stripe-billing", { method: "POST", body: "{}" }));
        expect(response.status).toBe(400);
    });

    it("rejects a request whose signature fails verification", async () => {
        mockVerifyWebhook.mockImplementation(() => { throw new Error("bad signature"); });
        const { POST } = await import("./route");
        const response = await POST(webhookRequest("{}"));
        expect(response.status).toBe(400);
    });

    it("grants credits, creates an invoice, and publishes PAYMENT_CAPTURED on invoice.payment_succeeded", async () => {
        mockVerifyWebhook.mockReturnValue(invoiceEvent());

        const { POST } = await import("./route");
        const response = await POST(webhookRequest("{}"));

        expect(response.status).toBe(200);
        expect(mockGetSubscriptionMetadata).toHaveBeenCalledWith("sub_1");
        expect(mockTx.team.update).toHaveBeenCalledWith({
            where: { id: "team-1" },
            data: { credits: { increment: 500 } },
        });
        expect(mockTx.creditTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ teamId: "team-1", amount: 500, paymentId: "in_1" }),
        }));
        expect(mockTx.invoice.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ teamId: "team-1", gateway: "STRIPE", paymentId: "in_1", amount: 2900, currency: "USD" }),
        }));
        expect(mockTx.outboxEvent.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ eventType: "PAYMENT_CAPTURED", teamId: "team-1", idempotencyKey: "stripe_payment_in_1" }),
        }));
    });

    it("does not re-process a payment already recorded (idempotency no-op)", async () => {
        mockVerifyWebhook.mockReturnValue(invoiceEvent());
        mockPrisma.creditTransaction.findFirst.mockResolvedValue({ id: "existing" });

        const { POST } = await import("./route");
        const response = await POST(webhookRequest("{}"));

        expect(response.status).toBe(200);
        expect(mockGetSubscriptionMetadata).not.toHaveBeenCalled();
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it("ignores unrelated event types", async () => {
        mockVerifyWebhook.mockReturnValue({ type: "customer.created", data: { object: {} } });

        const { POST } = await import("./route");
        const response = await POST(webhookRequest("{}"));

        expect(response.status).toBe(200);
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it("skips fulfillment when subscription metadata is missing required fields", async () => {
        mockVerifyWebhook.mockReturnValue(invoiceEvent());
        mockGetSubscriptionMetadata.mockResolvedValue({ teamId: "team-1" });

        const { POST } = await import("./route");
        const response = await POST(webhookRequest("{}"));

        expect(response.status).toBe(200);
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
});
