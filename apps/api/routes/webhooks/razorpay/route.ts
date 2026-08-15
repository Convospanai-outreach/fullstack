import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { addCredits } from "@/lib/credits";

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
                // must not grant credits a second time.
                const existing = await prisma.creditTransaction.findFirst({
                    where: { teamId: notes.teamId, meta: { path: ["paymentId"], equals: payment.id } }
                });

                if (!existing) {
                    if (notes.type === 'topup' && notes.credits) {
                        const credits = parseInt(notes.credits);
                        if (credits > 0) {
                            await addCredits(
                                notes.teamId,
                                credits,
                                `Top-up via Razorpay (ID: ${payment.id})`,
                                { paymentId: payment.id, orderId: payment.order_id },
                                "topup"
                            );
                        }
                    } else if (notes.planId && notes.userId) {
                        const plan = await prisma.plan.findUnique({ where: { id: notes.planId } });
                        if (plan) {
                            const periodEnd = new Date();
                            periodEnd.setDate(periodEnd.getDate() + 30);

                            await prisma.subscription.upsert({
                                where: { userId: notes.userId },
                                update: { planId: plan.id, status: "active", currentPeriodEnd: periodEnd },
                                create: {
                                    userId: notes.userId,
                                    planId: plan.id,
                                    status: "active",
                                    currentPeriodEnd: periodEnd
                                }
                            });

                            if (plan.creditsPerMonth > 0) {
                                await addCredits(
                                    notes.teamId,
                                    plan.creditsPerMonth,
                                    `${plan.name} subscription via Razorpay (ID: ${payment.id})`,
                                    { paymentId: payment.id, orderId: payment.order_id },
                                    "subscription"
                                );
                            }
                        } else {
                            console.error(`[Webhook] Unknown planId in payment notes: ${notes.planId}`);
                        }
                    } else {
                        // Fallback logic for payments with no recognized notes shape.
                        const amountInRupees = payment.amount / 100;
                        const credits = Math.floor(amountInRupees / 10);
                        if (credits > 0) {
                            await addCredits(
                                notes.teamId,
                                credits,
                                `Top-up via Razorpay (ID: ${payment.id})`,
                                { paymentId: payment.id, orderId: payment.order_id },
                                "topup"
                            );
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
