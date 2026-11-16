import { NextResponse } from "next/server";
import { z } from "zod";
import { logWebhookRejected } from "@/lib/webhookRejection";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import type { TransactionClient } from "@/lib/db";
import { addCredits } from "@/lib/credits";
import { computeGstInclusive } from "@/lib/gst";
import { OutboxService } from "@/lib/outboxService";
import { MONTHLY_PERIOD_DAYS, YEARLY_PERIOD_DAYS } from "@/modules/billing/service/yearlyCredits";

// Order notes are written server-side at checkout, but they reach the database layer through this
// webhook, so their shape is checked before any branch uses them. Ids are restricted to a safe
// character set rather than UUID-only because the checkout-order flow and older orders carry notes
// without teamId/userId, and plan ids are not guaranteed to be UUIDs.
const NoteId = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const NoteNumber = z.union([z.string().max(32), z.number()]);
const WebhookNotesSchema = z.object({
    teamId: NoteId.optional(),
    userId: NoteId.optional(),
    planId: NoteId.optional(),
    checkoutOrderId: NoteId.optional(),
    credits: z.coerce.number().int().positive().max(1_000_000).optional(),
    type: z.string().max(32).optional(),
    interval: z.string().max(16).optional(),
    country: z.string().max(3).optional(),
    state: z.string().max(100).optional(),
    taxableValue: NoteNumber.nullable().optional(),
    taxAmount: NoteNumber.nullable().optional(),
    taxType: z.string().max(10).optional(),
    taxRate: NoteNumber.nullable().optional(),
});

// GST is normally computed and added on top of the price at order-creation
// time (checkout/topup), then snapshotted into the order notes so the
// webhook reads it rather than re-deriving it. Orders that never went
// through those routes (the unrecognized-notes-shape fallback below) carry
// no such snapshot, so tax is extracted from the amount actually charged.
export function resolveTax(payment: any, notes: any) {
    if (notes.taxableValue !== undefined && notes.taxableValue !== null) {
        return {
            taxableValue: Number(notes.taxableValue),
            taxAmount: Number(notes.taxAmount) || 0,
            taxType: notes.taxType || "NONE",
            taxRate: notes.taxRate !== undefined && notes.taxRate !== null && notes.taxRate !== "" ? Number(notes.taxRate) : null
        };
    }
    return computeGstInclusive(payment.amount, notes.country || "IN", notes.state);
}

// Always called inside the same transaction as the payment's credit-grant
// reservation (see the branches below), so a failure here rolls that grant
// back too instead of leaving the payment credited with no invoice.
export async function createInvoice(client: TransactionClient, params: {
    teamId: string;
    userId: string;
    subscriptionId?: string;
    type: string;
    description: string;
    amount: number;
    currency: string;
    paymentId: string;
    orderId?: string;
    country?: string;
    state?: string;
    taxableValue: number;
    taxAmount: number;
    taxType: string;
    taxRate: number | null;
}) {
    await client.invoice.create({
        data: {
            invoiceNumber: `INV-${params.paymentId}`,
            teamId: params.teamId,
            userId: params.userId,
            subscriptionId: params.subscriptionId,
            type: params.type,
            description: params.description,
            amount: params.amount,
            currency: params.currency,
            paymentId: params.paymentId,
            orderId: params.orderId,
            taxableValue: params.taxableValue,
            taxAmount: params.taxAmount,
            taxType: params.taxType,
            taxRate: params.taxRate,
            billingCountry: params.country,
            billingState: params.state,
            status: "paid"
        }
    });
}

export async function POST(req: Request) {
    try {
        const signature = req.headers.get("x-razorpay-signature");
        const secret = process.env['RAZORPAY_WEBHOOK_SECRET'];

        // Verify signature
        if (!signature || !secret) {
            if (!secret) console.error("[Razorpay Webhook] RAZORPAY_WEBHOOK_SECRET is not configured.");
            else logWebhookRejected(req, "razorpay", "missing_signature");
            return new NextResponse("Missing Signature or Secret", { status: 400 });
        }

        // Need the raw body for signature verification
        // clone() is important if we consume body twice (json + text)
        // or ensure we only read text and then parse
        const rawBody = await req.text();
        const expectedSignature = crypto
            .createHmac("sha256", secret)
            .update(rawBody)
            .digest("hex");

        const signatureBuffer = Buffer.from(signature);
        const expectedBuffer = Buffer.from(expectedSignature);

        // timingSafeEqual throws on mismatched buffer length instead of returning false.
        if (signatureBuffer.length !== expectedBuffer.length ||
            !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
            logWebhookRejected(req, "razorpay", "invalid_signature", rawBody.length);
            return new NextResponse("Invalid Signature", { status: 400 });
        }

        const body = JSON.parse(rawBody);

        const event = body.event;
        const payload = body.payload;

        if (event === "payment.captured") {
            const payment = payload.payment.entity;
            // Razorpay sends notes as an empty array, not an object, when a payment has none.
            const rawNotes = Array.isArray(payment.notes) && payment.notes.length === 0 ? {} : payment.notes ?? {};
            const notesParsed = WebhookNotesSchema.safeParse(rawNotes);
            if (!notesParsed.success) {
                // Acknowledge so Razorpay stops retrying a body that will never parse, but leave a trace.
                console.error("razorpay_webhook_invalid_notes", { paymentId: payment.id, errors: notesParsed.error.flatten() });
                return NextResponse.json({ status: "ok" });
            }
            const notes = notesParsed.data;

            // Route (funnel checkout) orders are a separate flow from the platform's
            // own credit-grant/subscription billing below - they never create a
            // CreditTransaction or Invoice, so they need their own idempotency check
            // (an atomic PENDING -> CAPTURED transition) rather than reusing that
            // table's existence check, and must not fall through into the generic
            // credit-topup fallback further down.
            // The order is found by the Razorpay order id it was created with (Order.gatewaySessionId,
            // set server-side in checkoutService), not by payment notes: those aren't set server-side and
            // may not carry the order's notes at all. The captured amount must match the order too.
            const checkoutOrder = payment.order_id
                ? await prisma.order.findFirst({
                      where: { gateway: "RAZORPAY", gatewaySessionId: payment.order_id },
                      select: { id: true },
                  })
                : null;
            if (checkoutOrder || notes?.checkoutOrderId) {
                if (!checkoutOrder) return NextResponse.json({ status: "ok" });
                let notApplied: { teamId: string } | null = null;
                await prisma.$transaction(async (tx) => {
                    const claim = await tx.order.updateMany({
                        where: {
                            id: checkoutOrder.id,
                            status: "PENDING",
                            gateway: "RAZORPAY",
                            gatewaySessionId: payment.order_id,
                            amount: payment.amount,
                        },
                        data: { status: "CAPTURED", gatewayPaymentId: payment.id },
                    });
                    if (claim.count === 0) {
                        // Either a retry of a delivery already applied (same payment id), or a captured payment that
                        // could not be applied (amount differs, or the order is no longer PENDING).
                        const current = await tx.order.findUnique({ where: { id: checkoutOrder.id } });
                        if (current && current.gatewayPaymentId !== payment.id) notApplied = { teamId: current.teamId };
                    }
                    if (claim.count === 1) {
                        const order = await tx.order.findUnique({ where: { id: checkoutOrder.id } });
                        if (order) {
                            await OutboxService.publishEvent({
                                teamId: order.teamId,
                                eventType: "ORDER_CAPTURED",
                                aggregateType: "Order",
                                aggregateId: order.id,
                                payload: {
                                    orderId: order.id,
                                    productId: order.productId,
                                    customerId: order.customerEmail,
                                    amount: order.amount,
                                    gateway: "RAZORPAY",
                                },
                                idempotencyKey: `razorpay_order_${order.id}`,
                            }, tx);
                        }
                    }
                });
                if (notApplied) {
                    // Money was captured but the order was not marked paid. strict:true so a failed write 500s and
                    // Razorpay retries, rather than acknowledging an event nothing durable records.
                    const { AuditService } = await import("@/modules/audit/auditService");
                    await AuditService.log(
                        (notApplied as { teamId: string }).teamId,
                        null,
                        "WEBHOOK_ORDER_NOT_APPLIED",
                        "Order",
                        checkoutOrder.id,
                        { paymentId: payment.id, amount: payment.amount, currency: payment.currency },
                        null,
                        null,
                        true
                    );
                }
                return NextResponse.json({ status: "ok" });
            }

            if (notes.teamId) {
                // Re-bind so teamId stays a string inside the transaction callbacks below.
                const notes = { ...notesParsed.data, teamId: notesParsed.data.teamId! };
                // Cheap early-exit for a known retry. Not the correctness guarantee
                // by itself (two concurrent deliveries can both pass this read before
                // either writes) - that comes from the unique constraints on
                // CreditTransaction.paymentId and Invoice.invoiceNumber below, which
                // the DB enforces atomically regardless of this race.
                const [existingCredit, existingInvoice] = await Promise.all([
                    prisma.creditTransaction.findFirst({ where: { paymentId: payment.id } }),
                    prisma.invoice.findFirst({ where: { paymentId: payment.id } })
                ]);
                const existing = existingCredit || existingInvoice;

                if (!existing) {
                    if (notes.type === 'topup' && notes.credits) {
                        const credits = notes.credits;
                        if (credits > 0) {
                            const description = `${credits} credits top-up via Razorpay (ID: ${payment.id})`;
                            try {
                                // Credit grant and invoice creation run in one transaction:
                                // either both commit or neither does, so a failure creating
                                // the invoice can't leave the payment credited with no
                                // invoice and no way for a retry to notice - the retry just
                                // sees nothing committed and reprocesses cleanly.
                                await prisma.$transaction(async (tx) => {
                                    await addCredits(
                                        notes.teamId,
                                        credits,
                                        description,
                                        { paymentId: payment.id, orderId: payment.order_id },
                                        "topup",
                                        tx
                                    );
                                    if (notes.userId) {
                                        await createInvoice(tx, {
                                            teamId: notes.teamId,
                                            userId: notes.userId,
                                            type: "topup",
                                            description,
                                            amount: payment.amount,
                                            currency: payment.currency,
                                            paymentId: payment.id,
                                            orderId: payment.order_id,
                                            country: notes.country,
                                            state: notes.state,
                                            ...resolveTax(payment, notes)
                                        });
                                    }
                                    await OutboxService.publishEvent({
                                        teamId: notes.teamId,
                                        eventType: "PAYMENT_CAPTURED",
                                        aggregateType: "CreditTransaction",
                                        aggregateId: payment.id,
                                        payload: {
                                            type: "topup",
                                            credits,
                                            paymentId: payment.id,
                                            userId: notes.userId,
                                        },
                                        idempotencyKey: `razorpay_payment_${payment.id}`,
                                    }, tx);
                                });
                            } catch (error: any) {
                                // Unique constraint on CreditTransaction.paymentId means an
                                // earlier delivery already fully processed this payment.
                                if (error?.code !== "P2002") throw error;
                            }
                        }
                    } else if (notes.planId && notes.userId) {
                        const notes = { ...notesParsed.data, teamId: notesParsed.data.teamId!, userId: notesParsed.data.userId! };
                        const plan = await prisma.plan.findUnique({ where: { id: notes.planId } });
                        if (plan) {
                            // Order notes are set server-side at checkout. A yearly order is paid once for 12 months and
                            // credited monthly (see yearlyCredits.ts); a missing interval, e.g. an order created before
                            // yearly billing existed, is monthly.
                            const yearly = notes.interval === "year";
                            const periodDays = yearly ? YEARLY_PERIOD_DAYS : MONTHLY_PERIOD_DAYS;
                            const description = `${plan.name} plan ${yearly ? "yearly " : ""}subscription via Razorpay (ID: ${payment.id})`;
                            try {
                                // Same all-or-nothing transaction as the top-up branch,
                                // covering the credit grant, the subscription extension, and
                                // the invoice together. It also fixes a narrower race: two
                                // distinct renewal payments for the same user, each having
                                // won its own paymentId reservation, could otherwise both
                                // read the same currentPeriodEnd and overwrite each other -
                                // GREATEST(...)+30 days is computed by Postgres in a single
                                // statement, so concurrent deliveries serialize on the row
                                // instead of racing in application code. A yearly order adds a
                                // year, credits the first month now and schedules the next one.
                                await prisma.$transaction(async (tx) => {
                                    await addCredits(
                                        notes.teamId,
                                        plan.creditsPerMonth,
                                        description,
                                        { paymentId: payment.id, orderId: payment.order_id },
                                        "subscription",
                                        tx
                                    );

                                    const [subscription] = await tx.$queryRaw<{ id: string }[]>`
                                        INSERT INTO "Subscription" (id, "userId", "planId", status, "currentPeriodEnd", "billingInterval", "nextCreditGrantAt", "teamId", "createdAt", "updatedAt")
                                        VALUES (gen_random_uuid(), ${notes.userId}, ${plan.id}, 'active', NOW() + ${periodDays}::int * INTERVAL '1 day', ${yearly ? "YEAR" : "MONTH"}, CASE WHEN ${yearly}::boolean THEN NOW() + ${MONTHLY_PERIOD_DAYS}::int * INTERVAL '1 day' ELSE NULL END, ${notes.teamId}, NOW(), NOW())
                                        ON CONFLICT ("userId") DO UPDATE SET
                                            "planId" = EXCLUDED."planId",
                                            status = 'active',
                                            "currentPeriodEnd" = GREATEST("Subscription"."currentPeriodEnd", NOW()) + ${periodDays}::int * INTERVAL '1 day',
                                            "billingInterval" = EXCLUDED."billingInterval",
                                            "nextCreditGrantAt" = EXCLUDED."nextCreditGrantAt",
                                            "teamId" = EXCLUDED."teamId",
                                            "updatedAt" = NOW()
                                        RETURNING id
                                    `;

                                    await createInvoice(tx, {
                                        teamId: notes.teamId,
                                        userId: notes.userId,
                                        subscriptionId: subscription.id,
                                        type: "subscription",
                                        description,
                                        amount: payment.amount,
                                        currency: payment.currency,
                                        paymentId: payment.id,
                                        orderId: payment.order_id,
                                        country: notes.country,
                                        state: notes.state,
                                        ...resolveTax(payment, notes)
                                    });

                                    await OutboxService.publishEvent({
                                        teamId: notes.teamId,
                                        eventType: "PAYMENT_CAPTURED",
                                        aggregateType: "Subscription",
                                        aggregateId: subscription.id,
                                        payload: {
                                            type: "subscription",
                                            planId: plan.id,
                                            paymentId: payment.id,
                                            userId: notes.userId,
                                        },
                                        idempotencyKey: `razorpay_payment_${payment.id}`,
                                    }, tx);
                                });
                            } catch (error: any) {
                                if (error?.code !== "P2002") throw error;
                            }
                        } else {
                            console.error(`[Webhook] Unknown planId in payment notes: ${notes.planId}`);
                            // Payment was captured but nothing was provisioned - persist this so
                            // it's queryable/alertable instead of only visible in ephemeral logs.
                            // strict:true - if this write fails, nothing durable exists for this
                            // event at all, so let the failure propagate to the outer handler's
                            // 500 and have Razorpay retry rather than acknowledging an event we
                            // never actually recorded (AuditService.log swallows errors by default).
                            const { AuditService } = await import("@/modules/audit/auditService");
                            await AuditService.log(
                                notes.teamId,
                                notes.userId,
                                "WEBHOOK_UNRECOGNIZED_PLAN",
                                "Billing",
                                payment.id,
                                { planId: notes.planId, amount: payment.amount, currency: payment.currency },
                                null,
                                null,
                                true
                            );
                        }
                    } else {
                        // Fallback logic for payments with no recognized notes shape.
                        const amountInRupees = payment.amount / 100;
                        const credits = Math.floor(amountInRupees / 10);
                        if (credits > 0) {
                            const description = `Top-up via Razorpay (ID: ${payment.id})`;
                            try {
                                await prisma.$transaction(async (tx) => {
                                    await addCredits(
                                        notes.teamId,
                                        credits,
                                        description,
                                        { paymentId: payment.id, orderId: payment.order_id },
                                        "topup",
                                        tx
                                    );
                                    if (notes.userId) {
                                        await createInvoice(tx, {
                                            teamId: notes.teamId,
                                            userId: notes.userId,
                                            type: "topup",
                                            description,
                                            amount: payment.amount,
                                            currency: payment.currency,
                                            paymentId: payment.id,
                                            orderId: payment.order_id,
                                            country: notes.country,
                                            state: notes.state,
                                            ...resolveTax(payment, notes)
                                        });
                                    }
                                    await OutboxService.publishEvent({
                                        teamId: notes.teamId,
                                        eventType: "PAYMENT_CAPTURED",
                                        aggregateType: "CreditTransaction",
                                        aggregateId: payment.id,
                                        payload: {
                                            type: "topup",
                                            credits,
                                            paymentId: payment.id,
                                            userId: notes.userId,
                                        },
                                        idempotencyKey: `razorpay_payment_${payment.id}`,
                                    }, tx);
                                });
                            } catch (error: any) {
                                if (error?.code !== "P2002") throw error;
                            }
                        }
                    }
                }
            }
        }

        return NextResponse.json({ status: "ok" });
    } catch (error) {
        console.error("Razorpay Webhook Error:", error);
        return new NextResponse("Webhook Handler Failed", { status: 500 });
    }
}
