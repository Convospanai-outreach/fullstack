import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { OutboxService } from "@/lib/outboxService";
import { verifyStripeConnectWebhook } from "../gateways/stripeConnect";

export async function POST(req: Request) {
    try {
        const signature = req.headers.get("stripe-signature");
        if (!signature) {
            return new NextResponse("Missing Signature", { status: 400 });
        }

        const rawBody = await req.text();
        let event;
        try {
            event = verifyStripeConnectWebhook(rawBody, signature);
        } catch {
            return new NextResponse("Invalid Signature", { status: 400 });
        }

        if (event.type === "checkout.session.completed") {
            const session = event.data.object as any;
            const orderId = session.client_reference_id || session.metadata?.orderId;
            // This endpoint is a platform-wide Connect webhook: it receives
            // checkout.session.completed events from every team's connected
            // Stripe account, not just the one that owns `orderId`. Without
            // pinning the claim to the connected account the event actually
            // came from (event.account), a caller with their own connected
            // account could complete a session referencing another team's
            // order id and get that order marked CAPTURED without the
            // victim ever being paid.
            const connectedAccountId = (event as any).account;

            if (orderId && connectedAccountId) {
                // Order-capture and outbox-publish run in one transaction: if the
                // publish fails, the order is not left stranded as CAPTURED with
                // no event - a Stripe retry then finds it still PENDING and
                // re-attempts both together, instead of skipping the publish
                // forever (the PENDING->CAPTURED transition itself is what makes
                // a genuine retry a no-op).
                await prisma.$transaction(async (tx) => {
                    const claim = await tx.order.updateMany({
                        where: {
                            id: orderId,
                            status: "PENDING",
                            gateway: "STRIPE",
                            gatewayAccountId: connectedAccountId,
                        },
                        data: {
                            status: "CAPTURED",
                            gatewayPaymentId: session.payment_intent || session.id,
                        },
                    });

                    if (claim.count === 1) {
                        const order = await tx.order.findUnique({ where: { id: orderId } });
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
                                    gateway: "STRIPE",
                                },
                                idempotencyKey: `stripe_order_${order.id}`,
                            }, tx);
                        }
                    }
                });
            }
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error("[Stripe Connect Webhook]", error);
        return new NextResponse("Webhook Handler Failed", { status: 500 });
    }
}
