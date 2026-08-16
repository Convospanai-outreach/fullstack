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
        $queryRaw: vi.fn(),
        invoice: {
            create: vi.fn(),
            findFirst: vi.fn(),
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
        mockPrisma.invoice.findFirst.mockResolvedValue(null);
        mockPrisma.$queryRaw.mockResolvedValue([{ id: "sub-1" }]);
        mockAddCredits.mockResolvedValue({ granted: true });
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

    it("grants the plan's monthly credits, upserts a Subscription, and invoices using the GST snapshotted at order-creation time", async () => {
        mockPrisma.plan.findUnique.mockResolvedValue({ id: "plan-growth", name: "GROWTH", creditsPerMonth: 2500 });

        const { POST } = await import("./route");
        // amount (11682) is what checkout actually charged: 9900 base + 1782 CGST/SGST added on top.
        const response = await POST(signedRequest({
            event: "payment.captured",
            payload: {
                payment: {
                    entity: {
                        id: "pay_123",
                        order_id: "order_123",
                        amount: 11682,
                        currency: "USD",
                        notes: {
                            teamId: "team-1", userId: "user-1", planId: "plan-growth", country: "IN", state: "Delhi",
                            taxableValue: 9900, taxAmount: 1782, taxType: "CGST_SGST", taxRate: 18,
                        },
                    },
                },
            },
        }) as any);

        expect(response.status).toBe(200);
        const [strings, userId, planId] = mockPrisma.$queryRaw.mock.calls[0];
        expect(strings.join("")).toContain('INSERT INTO "Subscription"');
        expect(userId).toBe("user-1");
        expect(planId).toBe("plan-growth");
        expect(mockAddCredits).toHaveBeenCalledWith(
            "team-1",
            2500,
            expect.stringContaining("GROWTH"),
            expect.objectContaining({ paymentId: "pay_123" }),
            "subscription"
        );
        expect(mockPrisma.invoice.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                invoiceNumber: "INV-pay_123",
                teamId: "team-1",
                userId: "user-1",
                subscriptionId: "sub-1",
                amount: 11682,
                currency: "USD",
                taxableValue: 9900,
                taxAmount: 1782,
                taxType: "CGST_SGST",
                taxRate: 18,
                billingCountry: "IN",
                billingState: "Delhi",
                status: "paid",
            }),
        }));
    });

    it("invoices with IGST for a customer outside Delhi", async () => {
        mockPrisma.plan.findUnique.mockResolvedValue({ id: "plan-pro", name: "PRO", creditsPerMonth: 500 });

        const { POST } = await import("./route");
        await POST(signedRequest({
            event: "payment.captured",
            payload: {
                payment: {
                    entity: {
                        id: "pay_mh",
                        order_id: "order_mh",
                        amount: 5782,
                        currency: "USD",
                        notes: {
                            teamId: "team-1", userId: "user-1", planId: "plan-pro", country: "IN", state: "Maharashtra",
                            taxableValue: 4900, taxAmount: 882, taxType: "IGST", taxRate: 18,
                        },
                    },
                },
            },
        }) as any);

        expect(mockPrisma.invoice.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ taxType: "IGST", taxRate: 18 }),
        }));
    });

    it("invoices with no GST for a non-India customer (zero-rated export of services)", async () => {
        mockPrisma.plan.findUnique.mockResolvedValue({ id: "plan-pro", name: "PRO", creditsPerMonth: 500 });

        const { POST } = await import("./route");
        await POST(signedRequest({
            event: "payment.captured",
            payload: {
                payment: {
                    entity: {
                        id: "pay_us",
                        order_id: "order_us",
                        amount: 4900,
                        currency: "USD",
                        notes: {
                            teamId: "team-1", userId: "user-1", planId: "plan-pro", country: "US",
                            taxableValue: 4900, taxAmount: 0, taxType: "NONE", taxRate: null,
                        },
                    },
                },
            },
        }) as any);

        expect(mockPrisma.invoice.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                taxableValue: 4900,
                taxAmount: 0,
                taxType: "NONE",
                taxRate: null,
            }),
        }));
    });

    it("falls back to extracting GST from the charged amount when notes carry no order-time tax snapshot", async () => {
        // Simulates a payment whose notes never went through checkout/topup (e.g. a
        // manually created Razorpay payment link) - no taxableValue/taxAmount to read.
        mockPrisma.plan.findUnique.mockResolvedValue({ id: "plan-pro", name: "PRO", creditsPerMonth: 500 });

        const { POST } = await import("./route");
        await POST(signedRequest({
            event: "payment.captured",
            payload: {
                payment: {
                    entity: {
                        id: "pay_legacy",
                        order_id: "order_legacy",
                        amount: 9900,
                        currency: "USD",
                        notes: { teamId: "team-1", userId: "user-1", planId: "plan-pro", country: "IN", state: "Delhi" },
                    },
                },
            },
        }) as any);

        expect(mockPrisma.invoice.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                taxableValue: 8390, // extracted from the already-charged 9900 as tax-inclusive
                taxAmount: 1510,
                taxType: "CGST_SGST",
                taxRate: 18,
            }),
        }));
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
        expect(mockPrisma.invoice.create).not.toHaveBeenCalled();
    });

    it("does not create a duplicate invoice when two concurrent deliveries both pass the pre-check but the DB rejects the second credit grant", async () => {
        // Simulates the race CodeAnt flagged: the findFirst pre-check is a separate
        // read from the write, so both concurrent deliveries can see !existing. The
        // real guard is the unique constraint on CreditTransaction.paymentId, which
        // addCredits surfaces as granted: false for the loser instead of throwing.
        mockAddCredits.mockResolvedValue({ granted: false });

        const { POST } = await import("./route");
        const response = await POST(signedRequest({
            event: "payment.captured",
            payload: {
                payment: {
                    entity: {
                        id: "pay_race",
                        order_id: "order_race",
                        amount: 50000,
                        notes: { teamId: "team-1", type: "topup", credits: "500", userId: "user-1" },
                    },
                },
            },
        }) as any);

        expect(response.status).toBe(200);
        expect(mockAddCredits).toHaveBeenCalledTimes(1);
        expect(mockPrisma.invoice.create).not.toHaveBeenCalled();
    });

    it("does not re-create an invoice on retry for a zero-credit plan (no CreditTransaction exists to guard on)", async () => {
        mockPrisma.plan.findUnique.mockResolvedValue({ id: "plan-free", name: "FREE", creditsPerMonth: 0 });
        // No CreditTransaction was ever written for this payment (credits = 0), but the
        // invoice from the first delivery is now findable by paymentId.
        mockPrisma.invoice.findFirst.mockResolvedValue({ id: "inv-existing" });

        const { POST } = await import("./route");
        const response = await POST(signedRequest({
            event: "payment.captured",
            payload: {
                payment: {
                    entity: {
                        id: "pay_free",
                        order_id: "order_free",
                        amount: 0,
                        currency: "USD",
                        notes: { teamId: "team-1", userId: "user-1", planId: "plan-free", country: "IN", state: "Delhi" },
                    },
                },
            },
        }) as any);

        expect(response.status).toBe(200);
        expect(mockAddCredits).not.toHaveBeenCalled();
        expect(mockPrisma.invoice.create).not.toHaveBeenCalled();
    });

    it("does not create a duplicate subscription invoice when the concurrent credit grant loses the race", async () => {
        mockPrisma.plan.findUnique.mockResolvedValue({ id: "plan-growth", name: "GROWTH", creditsPerMonth: 2500 });
        mockAddCredits.mockResolvedValue({ granted: false });

        const { POST } = await import("./route");
        const response = await POST(signedRequest({
            event: "payment.captured",
            payload: {
                payment: {
                    entity: {
                        id: "pay_sub_race",
                        order_id: "order_sub_race",
                        amount: 9900,
                        currency: "USD",
                        notes: { teamId: "team-1", userId: "user-1", planId: "plan-growth", country: "US" },
                    },
                },
            },
        }) as any);

        expect(response.status).toBe(200);
        expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
        expect(mockPrisma.invoice.create).not.toHaveBeenCalled();
    });

    it("extends the subscription via a single atomic INSERT ... ON CONFLICT statement, not a separate read-then-write", async () => {
        // The period math (GREATEST(currentPeriodEnd, NOW()) + 30 days) is computed
        // by Postgres inside this one statement specifically so that two concurrent
        // deliveries for different payments serialize on the row instead of both
        // reading the same currentPeriodEnd and overwriting each other. That can't
        // be exercised against a mocked client - assert the statement shape and
        // params instead, and rely on the DB to do the arithmetic correctly.
        mockPrisma.plan.findUnique.mockResolvedValue({ id: "plan-growth", name: "GROWTH", creditsPerMonth: 2500 });

        const { POST } = await import("./route");
        await POST(signedRequest({
            event: "payment.captured",
            payload: {
                payment: {
                    entity: {
                        id: "pay_renew",
                        order_id: "order_renew",
                        amount: 9900,
                        currency: "USD",
                        notes: { teamId: "team-1", userId: "user-1", planId: "plan-growth", country: "US" },
                    },
                },
            },
        }) as any);

        const [strings, userId, planId] = mockPrisma.$queryRaw.mock.calls[0];
        const sql = strings.join("");
        expect(userId).toBe("user-1");
        expect(planId).toBe("plan-growth");
        expect(sql).toContain("ON CONFLICT");
        expect(sql).toContain("GREATEST");
        expect(sql).toContain("INTERVAL '30 days'");
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
        expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
        expect(mockAddCredits).not.toHaveBeenCalled();
    });
});
