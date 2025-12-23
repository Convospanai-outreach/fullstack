import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
    try {
        const signature = req.headers.get("x-razorpay-signature");
        const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

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

        if (signature !== expectedSignature) {
            return new NextResponse("Invalid Signature", { status: 400 });
        }

        const body = JSON.parse(rawBody);

        const event = body.event;
        const payload = body.payload;

        if (event === "payment.captured") {
            const payment = payload.payment.entity;
            const notes = payment.notes;

            // Add Credits
            if (notes.teamId) {
                let credits = 0;

                if (notes.type === 'topup' && notes.credits) {
                    credits = parseInt(notes.credits);
                } else if (notes.planId) {
                    // Subscription Payment? Handled elsewhere usually, or ignore here
                } else {
                    // Fallback logic
                    const amountInRupees = payment.amount / 100;
                    credits = Math.floor(amountInRupees / 10);
                }

                if (credits > 0) {
                    await prisma.team.update({
                        where: { id: notes.teamId },
                        data: { credits: { increment: credits } }
                    });

                    await prisma.creditTransaction.create({
                        data: {
                            teamId: notes.teamId,
                            amount: credits,
                            description: `Top-up via Razorpay (ID: ${payment.id})`,
                            type: "topup",
                            meta: { paymentId: payment.id, orderId: payment.order_id }
                        }
                    });
                }
            }
        }

        return NextResponse.json({ status: "ok" });
    } catch (error) {
        console.error("Razorpay Webhook Error:", error);
        return new NextResponse("Webhook Handler Failed", { status: 500 });
    }
}
