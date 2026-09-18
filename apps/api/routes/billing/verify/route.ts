import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { addCredits } from "@/lib/credits";
import { razorpay, isRazorpayConfigured } from "@/lib/razorpay";
import { OutboxService } from "@/lib/outboxService";
import { createInvoice, resolveTax } from "../../webhooks/razorpay/route";

// Client-side companion to the /webhooks/razorpay path: Razorpay Checkout's
// `handler` callback only proves the browser saw a success screen, so credits
// were previously granted *solely* by the webhook - if the webhook was
// misconfigured (wrong env name, unset secret), a payer could be charged and
// never credited with no visible failure. This route lets the browser grant
// credits immediately after a signature check, using the same idempotency
// key (CreditTransaction.paymentId) as the webhook so whichever path runs
// first wins and the other becomes a no-op.
export async function POST(req: NextRequest) {
    const ctx = await getCurrentContext();
    if (!ctx.teamId || !ctx.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!isRazorpayConfigured || !razorpay) {
        return NextResponse.json({ error: "Razorpay is not configured" }, { status: 503 });
    }
    const keySecret = process.env["RAZORPAY_KEY_SECRET"]!;

    const body = await req.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return NextResponse.json({ error: "Missing payment verification fields" }, { status: 400 });
    }

    const expectedSignature = crypto
        .createHmac("sha256", keySecret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex");

    const signatureBuffer = Buffer.from(razorpay_signature);
    const expectedBuffer = Buffer.from(expectedSignature);
    if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
        return NextResponse.json({ error: "Invalid payment signature" }, { status: 400 });
    }

    // Notes are read from Razorpay's own record of the order, not trusted from
    // the client, so a payer can't claim a different team's or a different
    // tier's credits by tampering with the verify request body.
    const order = await razorpay.orders.fetch(razorpay_order_id);
    const notes = (order.notes || {}) as Record<string, any>;

    if (notes["teamId"] !== ctx.teamId) {
        return NextResponse.json({ error: "Order does not belong to this team" }, { status: 403 });
    }
    if (notes["type"] !== "topup" || !notes["credits"]) {
        return NextResponse.json({ error: "Order is not a credit top-up" }, { status: 400 });
    }

    const credits = parseInt(notes["credits"]);
    if (!(credits > 0)) {
        return NextResponse.json({ error: "Invalid credit amount on order" }, { status: 400 });
    }

    const [existingCredit, existingInvoice] = await Promise.all([
        prisma.creditTransaction.findFirst({ where: { paymentId: razorpay_payment_id } }),
        prisma.invoice.findFirst({ where: { paymentId: razorpay_payment_id } }),
    ]);

    if (existingCredit || existingInvoice) {
        return NextResponse.json({ status: "ok", alreadyCredited: true });
    }

    const description = `${credits} credits top-up via Razorpay (ID: ${razorpay_payment_id})`;
    try {
        await prisma.$transaction(async (tx) => {
            await addCredits(
                ctx.teamId!,
                credits,
                description,
                { paymentId: razorpay_payment_id, orderId: razorpay_order_id },
                "topup",
                tx
            );
            await createInvoice(tx, {
                teamId: ctx.teamId!,
                userId: ctx.userId!,
                type: "topup",
                description,
                amount: order.amount as number,
                currency: order.currency,
                paymentId: razorpay_payment_id,
                orderId: razorpay_order_id,
                country: notes["country"],
                state: notes["state"],
                ...resolveTax({ amount: order.amount }, notes),
            });
            await OutboxService.publishEvent({
                teamId: ctx.teamId!,
                eventType: "PAYMENT_CAPTURED",
                aggregateType: "CreditTransaction",
                aggregateId: razorpay_payment_id,
                payload: { type: "topup", credits, paymentId: razorpay_payment_id, userId: ctx.userId },
                idempotencyKey: `razorpay_payment_${razorpay_payment_id}`,
            }, tx);
        });
    } catch (error: any) {
        // Unique constraint on CreditTransaction.paymentId means the webhook
        // already processed this payment between our existence check and this
        // write - that's the intended idempotent outcome, not a failure.
        if (error?.code !== "P2002") throw error;
    }

    return NextResponse.json({ status: "ok", credits });
}
