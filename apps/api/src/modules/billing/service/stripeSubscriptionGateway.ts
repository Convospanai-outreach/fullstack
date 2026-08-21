import { stripe, isStripeConfigured } from "@/lib/stripe";

export { isStripeConfigured };

// Platform-level subscription checkout: charges the platform's own Stripe account
// directly (no `stripeAccount` header), unlike the Connect flow in
// modules/checkout/gateways/stripeConnect.ts which charges a connected seller.
export async function createSubscriptionCheckoutSession(params: {
    stripePriceId: string;
    teamId: string;
    userId: string;
    planId: string;
    customerEmail?: string;
    successUrl: string;
    cancelUrl: string;
}): Promise<{ url: string; sessionId: string }> {
    if (!stripe) throw new Error("Stripe is not configured");

    const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price: params.stripePriceId, quantity: 1 }],
        customer_email: params.customerEmail,
        client_reference_id: params.teamId,
        metadata: { teamId: params.teamId, userId: params.userId, planId: params.planId },
        subscription_data: {
            metadata: { teamId: params.teamId, userId: params.userId, planId: params.planId },
        },
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
    });

    if (!session.url) throw new Error("Stripe did not return a checkout URL");
    return { url: session.url, sessionId: session.id };
}

export function verifyStripeBillingWebhook(rawBody: string, signature: string) {
    if (!stripe) throw new Error("Stripe is not configured");
    const secret = process.env["STRIPE_BILLING_WEBHOOK_SECRET"];
    if (!secret) throw new Error("STRIPE_BILLING_WEBHOOK_SECRET is not configured");
    return stripe.webhooks.constructEvent(rawBody, signature, secret);
}

// Reads back the {teamId, userId, planId} metadata stamped onto the Stripe subscription
// at checkout time (see subscription_data.metadata above), so a later renewal invoice
// can be fulfilled without depending on our own DB already having a row for it.
export async function getSubscriptionMetadata(subscriptionId: string): Promise<{
    teamId?: string;
    userId?: string;
    planId?: string;
}> {
    if (!stripe) throw new Error("Stripe is not configured");
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    return subscription.metadata || {};
}
