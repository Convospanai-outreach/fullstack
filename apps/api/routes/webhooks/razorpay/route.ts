import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { addCredits } from "@/lib/credits";
import { computeGst } from "@/lib/gst";

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
}) {
    const { taxableValue, taxAmount, taxType, taxRate } = computeGst(
        params.amount,
        params.country || "IN",
        params.state
    );

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
                taxableValue,
                taxAmount,
                taxType,
                taxRate,
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
                // Razorpay retries webhook delivery; a payment already recorded
                // must not grant credits or create an invoice a second time.
                // Zero-credit subscriptions (e.g. a plan with creditsPerMonth = 0)
                // create an invoice but no CreditTransaction, so both must be checked.
                const [existingCredit, existingInvoice] = await Promise.all([
                    prisma.creditTransaction.findFirst({
                        where: { teamId: notes.teamId, meta: { path: ["paymentId"], equals: payment.id } }
                    }),
                    prisma.invoice.findFirst({ where: { paymentId: payment.id } })
                ]);
                const existing = existingCredit || existingInvoice;

                if (!existing) {
                    if (notes.type === 'topup' && notes.credits) {
                        const credits = parseInt(notes.credits);
                        if (credits > 0) {
                            const description = `${credits} credits top-up via Razorpay (ID: ${payment.id})`;
                            await addCredits(
                                notes.teamId,
                                credits,
                                description,
                                { paymentId: payment.id, orderId: payment.order_id },
                                "topup"
                            );
                            if (notes.userId) {
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
                                    state: notes.state
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
                            if (plan.creditsPerMonth > 0) {
                                await addCredits(
                                    notes.teamId,
                                    plan.creditsPerMonth,
                                    description,
                                    { paymentId: payment.id, orderId: payment.order_id },
                                    "subscription"
                                );
                            }
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
                                state: notes.state
                            });
                        } else {
                            console.error(`[Webhook] Unknown planId in payment notes: ${notes.planId}`);
                        }
                    } else {
                        // Fallback logic for payments with no recognized notes shape.
                        const amountInRupees = payment.amount / 100;
                        const credits = Math.floor(amountInRupees / 10);
                        if (credits > 0) {
                            const description = `Top-up via Razorpay (ID: ${payment.id})`;
                            await addCredits(
                                notes.teamId,
                                credits,
                                description,
                                { paymentId: payment.id, orderId: payment.order_id },
                                "topup"
                            );
                            if (notes.userId) {
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
                                    state: notes.state
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
