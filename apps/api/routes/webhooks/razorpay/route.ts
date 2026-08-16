import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import type { TransactionClient } from "@/lib/db";
import { addCredits } from "@/lib/credits";
import { computeGstInclusive } from "@/lib/gst";

// GST is normally computed and added on top of the price at order-creation
// time (checkout/topup), then snapshotted into the order notes so the
// webhook reads it rather than re-deriving it. Orders that never went
// through those routes (the unrecognized-notes-shape fallback below) carry
// no such snapshot, so tax is extracted from the amount actually charged.
function resolveTax(payment: any, notes: any) {
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
async function createInvoice(client: TransactionClient, params: {
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
            return new NextResponse("Invalid Signature", { status: 400 });
        }

        const body = JSON.parse(rawBody);

        const event = body.event;
        const payload = body.payload;

        if (event === "payment.captured") {
            const payment = payload.payment.entity;
            const notes = payment.notes;

            if (notes.teamId) {
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
                        const credits = parseInt(notes.credits);
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
                                });
                            } catch (error: any) {
                                // Unique constraint on CreditTransaction.paymentId means an
                                // earlier delivery already fully processed this payment.
                                if (error?.code !== "P2002") throw error;
                            }
                        }
                    } else if (notes.planId && notes.userId) {
                        const plan = await prisma.plan.findUnique({ where: { id: notes.planId } });
                        if (plan) {
                            const description = `${plan.name} plan subscription via Razorpay (ID: ${payment.id})`;
                            try {
                                // Same all-or-nothing transaction as the top-up branch,
                                // covering the credit grant, the subscription extension, and
                                // the invoice together. It also fixes a narrower race: two
                                // distinct renewal payments for the same user, each having
                                // won its own paymentId reservation, could otherwise both
                                // read the same currentPeriodEnd and overwrite each other -
                                // GREATEST(...)+30 days is computed by Postgres in a single
                                // statement, so concurrent deliveries serialize on the row
                                // instead of racing in application code.
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
                                        INSERT INTO "Subscription" (id, "userId", "planId", status, "currentPeriodEnd", "createdAt", "updatedAt")
                                        VALUES (gen_random_uuid(), ${notes.userId}, ${plan.id}, 'active', NOW() + INTERVAL '30 days', NOW(), NOW())
                                        ON CONFLICT ("userId") DO UPDATE SET
                                            "planId" = EXCLUDED."planId",
                                            status = 'active',
                                            "currentPeriodEnd" = GREATEST("Subscription"."currentPeriodEnd", NOW()) + INTERVAL '30 days',
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
