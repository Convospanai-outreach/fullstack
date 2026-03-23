import { razorpay, isRazorpayConfigured } from "@/lib/razorpay";
import { prisma } from "@/lib/db";

class BillingService {
    async createOrder(amount: number, currency: string = "INR", receipt: string, notes: any = {}) {
        try {
            if (!isRazorpayConfigured || !razorpay) {
                throw new Error("Razorpay is not configured");
            }
            const options = {
                amount: amount * 100, // Razorpay accepts amount in smallest currency unit
                currency,
                receipt,
                notes,
            };

            const order = await razorpay.orders.create(options);

            // Log Order Creation
            try {
                if (notes.userId && notes.teamId) {
                    const { AuditService } = await import("@/modules/audit/auditService");
                    await AuditService.log(
                        notes.teamId,
                        notes.userId,
                        "ORDER_CREATED",
                        "Billing",
                        order.id,
                        { amount: order.amount }
                    );
                }
            } catch (e) { }

            return order;
        } catch (error) {
            console.error("[Billing] Error creating Razorpay order:", error);
            throw new Error("Failed to create Razorpay order");
        }
    }

    async createTopUpOrder(teamId: string, amount: number, credits: number) {
        return this.createOrder(amount, "INR", `topup_${teamId}_${Date.now()}`, {
            type: "topup",
            teamId,
            credits
        });
    }


    async getSubscriptionStatus(teamId: string) {
        // Find owner of the team
        const membership = await prisma.teamMember.findFirst({
            where: { teamId, role: "owner" },
            select: { userId: true }
        });

        if (!membership || !membership.userId) {
            return { active: false, plan: "free", currentPeriodEnd: null };
        }

        const subscription = await prisma.subscription.findUnique({
            where: { userId: membership.userId },
            include: { plan: true }
        });

        if (!subscription) {
            return { active: false, plan: "free", currentPeriodEnd: null };
        }

        return {
            active: subscription.status === "active",
            plan: subscription.plan.name || "free",
            currentPeriodEnd: subscription.currentPeriodEnd,
            credits: subscription.plan.creditsPerMonth
        };
    }

    async getTeamCredits(teamId: string) {
        const team = await prisma.team.findUnique({
            where: { id: teamId },
            select: { credits: true }
        });
        return team?.credits || 0;
    }

    async getPaymentHistory(teamId: string) {
        return await prisma.creditTransaction.findMany({
            where: { teamId },
            orderBy: { createdAt: "desc" },
            take: 20
        });
    }
}

export const billingService = new BillingService();
