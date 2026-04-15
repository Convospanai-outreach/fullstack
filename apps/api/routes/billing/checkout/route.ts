import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { billingService } from "@/modules/billing/service/billingService";
import { prisma } from "@/lib/db";

const PRICING_TIERS: Record<string, number> = {
    // Pro Plan
    "price_1Q": 29,
    "price_pro_monthly": 29,
    "price_pro_yearly": 290,
    // Enterprise / Growth
    "price_growth": 99,
    "price_enterprise": 299
};

const PLAN_ALIASES: Record<string, string> = {
    starter: "PRO",
    pro: "PRO",
    enterprise: "ENTERPRISE"
};

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const body = await req.json();
        const { priceId, planId } = body;

        let orderAmount = 0;

        // 1. Determine Amount from Price ID (Subscription)
        if (priceId) {
            // Check known tiers
            const tierPrice = Object.entries(PRICING_TIERS).find(([key]) => priceId.includes(key))?.[1];
            if (tierPrice) {
                orderAmount = tierPrice;
            } else {
                console.warn(`[Checkout] Unknown priceId: ${priceId}`);
            }
        }

        // 2. Plan-based pricing (server-side lookup)
        if (!orderAmount && planId) {
            const normalized = String(planId).toLowerCase();
            const planName = PLAN_ALIASES[normalized] || normalized.toUpperCase();
            const plan = await prisma.plan.findUnique({ where: { name: planName } });
            if (!plan) {
                return new NextResponse("Invalid Plan", { status: 400 });
            }
            orderAmount = plan.monthlyPrice;
        }

        // Default to PRO if still 0 (Safety net or error?)
        if (orderAmount === 0 && priceId) {
            return new NextResponse("Invalid Price Configuration", { status: 400 });
        }

        if (orderAmount <= 0) {
            return new NextResponse("Invalid Amount", { status: 400 });
        }

        const currency = process.env['APP_CURRENCY'] || "USD";
        const order = await billingService.createOrder(
            orderAmount,
            currency,
            `receipt_${Date.now()}`,
            { userId: session.user.id, priceId }
        );

        return NextResponse.json({ 
            orderId: order.id, 
            amount: order.amount, 
            currency: order.currency, 
            key: process.env['NEXT_PUBLIC_RAZORPAY_KEY_ID'] 
        });
    } catch (error) {
        console.error("[RAZORPAY_CHECKOUT]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
