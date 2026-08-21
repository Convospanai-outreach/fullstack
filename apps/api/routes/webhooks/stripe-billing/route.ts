import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { addCredits } from "@/lib/credits";
import { OutboxService } from "@/lib/outboxService";
import { verifyStripeBillingWebhook, getSubscriptionMetadata } from "@/modules/billing/service/stripeSubscriptionGateway";

// Platform-level Stripe subscription billing webhook. Separate endpoint (and
// signing secret) from routes/webhooks/stripe-connect, which is a different
// flow (marketplace Connect checkout, not the platform's own subscriptions).
//
// Only invoice.payment_succeeded is handled: it fires for both the first
// invoice and every renewal, and is self-sufficient — the {teamId, userId,
// planId} needed to fulfill it are read back from the Stripe subscription's
// own metadata (stamped at checkout time), not from our DB, so it doesn't
// depend on any other webhook having landed first.
export async function POST(req: Request) {
    try {
        const signature = req.headers.get("stripe-signature");
        if (!signature) {
            return new NextResponse("Missing Signature", { status: 400 });
        }

        const rawBody = await req.text();
        let event: Stripe.Event;
        try {
            event = verifyStripeBillingWebhook(rawBody, signature);
        } catch {
            return new NextResponse("Invalid Signature", { status: 400 });
        }

        if (event.type === "invoice.payment_succeeded") {
            const invoice = event.data.object as Stripe.Invoice;
            const subscriptionId = typeof (invoice as any).subscription === "string"
                ? (invoice as any).subscription
                : (invoice as any).subscription?.id;

            if (subscriptionId) {
                // One Stripe invoice = one billing cycle (first payment or a renewal), so its id
                // is a stable, unique-per-charge identifier - exactly what paymentId needs to be.
                const paymentId = invoice.id || `stripe_invoice_${subscriptionId}_${invoice.created}`;

                // Cheap early-exit for a known retry, same as the Razorpay webhook -
                // the real guarantee is the unique constraint on CreditTransaction.paymentId below.
                const [existingCredit, existingInvoice] = await Promise.all([
                    prisma.creditTransaction.findFirst({ where: { paymentId } }),
                    prisma.invoice.findFirst({ where: { paymentId } }),
                ]);

                if (!existingCredit && !existingInvoice) {
                    const metadata = await getSubscriptionMetadata(subscriptionId);
                    const { teamId, userId, planId } = metadata;

                    if (teamId && userId && planId) {
                        const plan = await prisma.plan.findUnique({ where: { id: planId } });
                        if (plan) {
                            const description = `${plan.name} plan subscription via Stripe (ID: ${paymentId})`;
                            try {
                                await prisma.$transaction(async (tx) => {
                                    await addCredits(
                                        teamId,
                                        plan.creditsPerMonth,
                                        description,
                                        { paymentId, orderId: subscriptionId },
                                        "subscription",
                                        tx
                                    );

                                    // Same GREATEST(...)+30 days pattern as the Razorpay webhook's
                                    // subscription branch, so concurrent renewal deliveries for the
                                    // same user serialize on the row instead of racing in app code.
                                    const [subscription] = await tx.$queryRaw<{ id: string }[]>`
                                        INSERT INTO "Subscription" (id, "userId", "planId", status, "currentPeriodEnd", gateway, "externalSubscriptionId", "createdAt", "updatedAt")
                                        VALUES (gen_random_uuid(), ${userId}, ${plan.id}, 'active', NOW() + INTERVAL '30 days', 'STRIPE', ${subscriptionId}, NOW(), NOW())
                                        ON CONFLICT ("userId") DO UPDATE SET
                                            "planId" = EXCLUDED."planId",
                                            status = 'active',
                                            gateway = 'STRIPE',
                                            "externalSubscriptionId" = EXCLUDED."externalSubscriptionId",
                                            "currentPeriodEnd" = GREATEST("Subscription"."currentPeriodEnd", NOW()) + INTERVAL '30 days',
                                            "updatedAt" = NOW()
                                        RETURNING id
                                    `;

                                    await tx.invoice.create({
                                        data: {
                                            invoiceNumber: `INV-${paymentId}`,
                                            teamId,
                                            userId,
                                            subscriptionId: subscription.id,
                                            type: "subscription",
                                            description,
                                            amount: invoice.amount_paid,
                                            currency: invoice.currency.toUpperCase(),
                                            gateway: "STRIPE",
                                            paymentId,
                                            status: "paid",
                                        },
                                    });

                                    await OutboxService.publishEvent({
                                        teamId,
                                        eventType: "PAYMENT_CAPTURED",
                                        aggregateType: "Subscription",
                                        aggregateId: subscription.id,
                                        payload: { type: "subscription", planId: plan.id, paymentId, userId, gateway: "STRIPE" },
                                        idempotencyKey: `stripe_payment_${paymentId}`,
                                    }, tx);
                                });
                            } catch (error: any) {
                                // Unique constraint on CreditTransaction.paymentId means an
                                // earlier delivery already fully processed this payment.
                                if (error?.code !== "P2002") throw error;
                            }
                        } else {
                            console.error(`[Stripe Billing Webhook] Unknown planId in subscription metadata: ${planId}`);
                        }
                    } else {
                        console.error(`[Stripe Billing Webhook] Subscription ${subscriptionId} is missing teamId/userId/planId metadata`);
                    }
                }
            }
        }

        return NextResponse.json({ status: "ok" });
    } catch (error) {
        console.error("[Stripe Billing Webhook]", error);
        return new NextResponse("Webhook Handler Failed", { status: 500 });
    }
}
