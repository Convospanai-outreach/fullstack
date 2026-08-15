import { razorpay, isRazorpayConfigured } from "@/lib/razorpay";
import { prisma } from "@/lib/db";

class BillingService {
    /**
     * @param amount Amount in the currency's smallest unit (e.g. cents, paise) - NOT major units.
     */
    async createOrder(amount: number, currency: string = "INR", receipt: string, notes: any = {}) {
        try {
            if (!isRazorpayConfigured || !razorpay) {
                throw new Error("Razorpay is not configured");
            }
            const options = {
                amount,
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

    async createTopUpOrder(
        teamId: string,
        userId: string,
        amount: number,
        credits: number,
        country: string,
        state?: string,
        tax?: { taxableValue: number; taxAmount: number; taxType: string; taxRate: number | null }
    ) {
        // Top-up tiers are INR-denominated (see routes/billing/topup/route.ts TIERS);
        // unrelated to the USD-denominated /pricing subscription checkout.
        return this.createOrder(amount, "INR", `topup_${teamId}_${Date.now()}`, {
            type: "topup",
            teamId,
            userId,
            credits,
            country,
            state,
            taxableValue: tax?.taxableValue,
            taxAmount: tax?.taxAmount,
            taxType: tax?.taxType,
            taxRate: tax?.taxRate
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

        const notExpired = subscription.currentPeriodEnd.getTime() > Date.now();

        return {
            active: subscription.status === "active" && notExpired,
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
