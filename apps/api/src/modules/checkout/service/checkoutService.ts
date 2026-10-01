import { prisma } from "@/lib/db";
import { productService } from "./productService";
import { paymentAccountService, type Gateway } from "./paymentAccountService";
import { createStripeCheckoutSession } from "../gateways/stripeConnect";
import { createRazorpayRouteOrder } from "../gateways/razorpayRoute";

interface CreateSessionInput {
    productId: string;
    gateway: Gateway;
    customerEmail?: string;
    customerName?: string;
    landingPageSlug?: string;
    successUrl?: string;
    cancelUrl?: string;
    // UTM of the checkout page URL (attribution)
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmTerm?: string;
    utmContent?: string;
}

class CheckoutService {
    async createSession(input: CreateSessionInput) {
        const product = await productService.getActiveById(input.productId);
        if (!product) {
            throw new Error("Product not found or is not active");
        }

        const account = await paymentAccountService.getActive(product.teamId, input.gateway);
        if (!account?.externalAccountId) {
            throw new Error(`This seller has not connected a ${input.gateway === "STRIPE" ? "Stripe" : "Razorpay"} account`);
        }

        const order = await prisma.order.create({
            data: {
                teamId: product.teamId,
                productId: product.id,
                gateway: input.gateway,
                gatewayAccountId: account.externalAccountId,
                customerEmail: input.customerEmail,
                customerName: input.customerName,
                amount: product.priceAmount,
                currency: product.currency,
                status: "PENDING",
                landingPageSlug: input.landingPageSlug,
                utmSource: input.utmSource,
                utmMedium: input.utmMedium,
                utmCampaign: input.utmCampaign,
                utmTerm: input.utmTerm,
                utmContent: input.utmContent,
            },
        });

        if (input.gateway === "STRIPE") {
            const appOrigin = process.env["NEXT_PUBLIC_APP_URL"] || "http://localhost:3000";
            const session = await createStripeCheckoutSession({
                connectedAccountId: account.externalAccountId,
                productName: product.name,
                amount: product.priceAmount,
                currency: product.currency,
                orderId: order.id,
                successUrl: input.successUrl || `${appOrigin}/checkout/${product.id}/success?order=${order.id}`,
                cancelUrl: input.cancelUrl || `${appOrigin}/checkout/${product.id}`,
                customerEmail: input.customerEmail,
            });

            await prisma.order.update({
                where: { id: order.id },
                data: { gatewaySessionId: session.sessionId },
            });
            await checkoutStarted(order.id);

            return { orderId: order.id, gateway: "STRIPE" as const, url: session.url };
        }

        const rpOrder = await createRazorpayRouteOrder({
            linkedAccountId: account.externalAccountId,
            amount: product.priceAmount,
            currency: product.currency,
            receipt: `order_${order.id}`,
            notes: {
                checkoutOrderId: order.id,
                teamId: product.teamId,
                productId: product.id,
            },
        });

        await prisma.order.update({
            where: { id: order.id },
            data: { gatewaySessionId: rpOrder.id },
        });
        await checkoutStarted(order.id);

        return {
            orderId: order.id,
            gateway: "RAZORPAY" as const,
            razorpayOrderId: rpOrder.id,
            amount: product.priceAmount,
            currency: product.currency,
            key: process.env["NEXT_PUBLIC_RAZORPAY_KEY_ID"],
        };
    }
}

// Creator funnel (checkoutHooks.ts): the buyer's existing lead moves to BOFU. Runs only once the
// gateway session exists, and never fails the public checkout.
async function checkoutStarted(orderId: string) {
    try {
        const { onCheckoutStarted } = await import("@/modules/creator-funnel/checkoutHooks");
        await onCheckoutStarted(orderId);
    } catch (error) {
        console.warn(`[Checkout] Creator funnel hook failed for order ${orderId}: ${error instanceof Error ? error.message : error}`);
    }
}

export const checkoutService = new CheckoutService();
