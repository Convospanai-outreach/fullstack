import { stripe, isStripeConfigured } from "@/lib/stripe";

export { isStripeConfigured };

export function getStripeConnectAuthorizeUrl(state: string): string {
    if (!stripe) throw new Error("Stripe is not configured");
    const clientId = process.env["STRIPE_CONNECT_CLIENT_ID"];
    if (!clientId) throw new Error("STRIPE_CONNECT_CLIENT_ID is not configured");

    return stripe.oauth.authorizeUrl({
        client_id: clientId,
        response_type: "code",
        scope: "read_write",
        state,
    });
}

export async function exchangeStripeOAuthCode(code: string): Promise<{ stripeUserId: string }> {
    if (!stripe) throw new Error("Stripe is not configured");
    const token = await stripe.oauth.token({ grant_type: "authorization_code", code });
    if (!token.stripe_user_id) throw new Error("Stripe did not return a connected account id");
    return { stripeUserId: token.stripe_user_id };
}

export async function createStripeCheckoutSession(params: {
    connectedAccountId: string;
    productName: string;
    amount: number;
    currency: string;
    orderId: string;
    successUrl: string;
    cancelUrl: string;
    customerEmail?: string;
}): Promise<{ url: string; sessionId: string }> {
    if (!stripe) throw new Error("Stripe is not configured");

    const session = await stripe.checkout.sessions.create(
        {
            mode: "payment",
            line_items: [
                {
                    price_data: {
                        currency: params.currency.toLowerCase(),
                        unit_amount: params.amount,
                        product_data: { name: params.productName },
                    },
                    quantity: 1,
                },
            ],
            customer_email: params.customerEmail,
            client_reference_id: params.orderId,
            metadata: { orderId: params.orderId },
            success_url: params.successUrl,
            cancel_url: params.cancelUrl,
        },
        { stripeAccount: params.connectedAccountId }
    );

    if (!session.url) throw new Error("Stripe did not return a checkout URL");
    return { url: session.url, sessionId: session.id };
}

export function verifyStripeConnectWebhook(rawBody: string, signature: string) {
    if (!stripe) throw new Error("Stripe is not configured");
    const secret = process.env["STRIPE_CONNECT_WEBHOOK_SECRET"];
    if (!secret) throw new Error("STRIPE_CONNECT_WEBHOOK_SECRET is not configured");
    return stripe.webhooks.constructEvent(rawBody, signature, secret);
}
