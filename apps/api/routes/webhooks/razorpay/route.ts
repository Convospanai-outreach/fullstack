import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
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

async function createInvoice(params: {
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
    try {
        await prisma.invoice.create({
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
    } catch (error: any) {
        // Unique constraint on invoiceNumber (INV-{paymentId}) means a concurrent
        // or retried webhook delivery already created this invoice — not an error.
        if (error?.code !== "P2002") throw error;
    }
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
                            const { granted } = await addCredits(
                                notes.teamId,
                                credits,
                                description,
                                { paymentId: payment.id, orderId: payment.order_id },
                                "topup"
                            );
                            if (granted && notes.userId) {
                                await createInvoice({
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
                        }
                    } else if (notes.planId && notes.userId) {
                        const plan = await prisma.plan.findUnique({ where: { id: notes.planId } });
                        if (plan) {
                            const periodEnd = new Date();
                            periodEnd.setDate(periodEnd.getDate() + 30);

                            const subscription = await prisma.subscription.upsert({
                                where: { userId: notes.userId },
                                update: { planId: plan.id, status: "active", currentPeriodEnd: periodEnd },
                                create: {
                                    userId: notes.userId,
                                    planId: plan.id,
                                    status: "active",
                                    currentPeriodEnd: periodEnd
                                }
                            });

                            const description = `${plan.name} plan subscription via Razorpay (ID: ${payment.id})`;
                            let granted = true;
                            if (plan.creditsPerMonth > 0) {
                                ({ granted } = await addCredits(
                                    notes.teamId,
                                    plan.creditsPerMonth,
                                    description,
                                    { paymentId: payment.id, orderId: payment.order_id },
                                    "subscription"
                                ));
                            }
                            if (granted) {
                                await createInvoice({
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
                            }
                        } else {
                            console.error(`[Webhook] Unknown planId in payment notes: ${notes.planId}`);
                        }
                    } else {
                        // Fallback logic for payments with no recognized notes shape.
                        const amountInRupees = payment.amount / 100;
                        const credits = Math.floor(amountInRupees / 10);
                        if (credits > 0) {
                            const description = `Top-up via Razorpay (ID: ${payment.id})`;
                            const { granted } = await addCredits(
                                notes.teamId,
                                credits,
                                description,
                                { paymentId: payment.id, orderId: payment.order_id },
                                "topup"
                            );
                            if (granted && notes.userId) {
                                await createInvoice({
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
