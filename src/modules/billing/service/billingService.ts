import { razorpay } from "@/lib/razorpay";
import { prisma } from "@/lib/db";

class BillingService {
    async createOrder(amount: number, currency: string = "INR", receipt: string, notes: any = {}) {
        try {
            const options = {
                amount: amount * 100, // Razorpay accepts amount in smallest currency unit
                currency,
                receipt,
                notes,
            };

            const order = await razorpay.orders.create(options);

            // Log Order Creation
            // We need a userId here. `notes` has it.
            try {
                if (notes.userId) {
                    const { auditService } = await import("@/modules/audit-logs/service/auditService");
                    await auditService.logAction(notes.userId, "ORDER_CREATED", "Billing", { orderId: order.id, amount: order.amount });
                }
            } catch (e) { }

            return order;
        } catch (error) {
            console.error("[Billing] Error creating Razorpay order:", error);
            throw new Error("Failed to create Razorpay order");
        }
    }

    async getSubscriptionStatus(teamId: string) {
        // Fetch subscription status from DB
        const subscription = await prisma.subscription.findUnique({
            where: { teamId },
        });

        if (!subscription) {
            return {
                active: false,
                plan: "free",
                currentPeriodEnd: null,
            };
        }

        return {
            active: subscription.status === "active",
            plan: subscription.razorpayPlanId || "pro", // Default to pro if plan ID not tracked specifically yet
            currentPeriodEnd: subscription.currentPeriodEnd,
        };
    }
}

export const billingService = new BillingService();
