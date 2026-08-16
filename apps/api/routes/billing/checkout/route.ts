import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { billingService } from "@/modules/billing/service/billingService";
import { authorizeRole, TeamRole } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { computeGstExclusive } from "@/lib/gst";

// Amounts are in the currency's smallest unit (e.g. cents), matching Plan.monthlyPrice.
const PRICING_TIERS: Record<string, number> = {
    // Pro Plan
    "price_1Q": 2900,
    "price_pro_monthly": 2900,
    "price_pro_yearly": 29000,
    // Enterprise / Growth
    "price_growth": 9900,
    "price_enterprise": 29900
};

const PLAN_ALIASES: Record<string, string> = {
    starter: "PRO",
    pro: "PRO",
    growth: "GROWTH",
    enterprise: "ENTERPRISE"
};

export async function POST(req: Request) {
    try {
        const { userId, teamId } = await getCurrentContext();

        if (!userId || !teamId) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        await authorizeRole(userId, teamId, TeamRole.ADMIN);

        const body = await req.json();
        const { priceId, planId, state } = body;
        // Normalized so "in"/"In" is recognized as India for GST purposes, not
        // silently treated as a non-India zero-rated export.
        const country = typeof body.country === "string" ? body.country.trim().toUpperCase() : body.country;

        if (!country || typeof country !== "string") {
            return new NextResponse("Billing country is required", { status: 400 });
        }
        if (country === "IN" && (!state || typeof state !== "string")) {
            return new NextResponse("Billing state is required for India", { status: 400 });
        }

        let orderAmount = 0;
        let plan: { id: string; monthlyPrice: number; name: string } | null = null;

        // 1. Plan-based pricing (server-side lookup) - the primary path used by /pricing
        if (planId) {
            const normalized = String(planId).toLowerCase();
            const planName = PLAN_ALIASES[normalized] || normalized.toUpperCase();
            plan = await prisma.plan.findUnique({ where: { name: planName } });
            if (!plan) {
                return new NextResponse("Invalid Plan", { status: 400 });
            }
            orderAmount = plan.monthlyPrice;
        }

        // 2. Determine Amount from Price ID (legacy path)
        if (!orderAmount && priceId) {
            const tierPrice = Object.entries(PRICING_TIERS).find(([key]) => priceId.includes(key))?.[1];
            if (tierPrice) {
                orderAmount = tierPrice;
            } else {
                console.warn(`[Checkout] Unknown priceId: ${priceId}`);
            }
        }

        if (orderAmount <= 0) {
            return new NextResponse("Invalid Amount", { status: 400 });
        }

        // Persist as the team's last-known billing address; the exact value used for
        // *this* transaction is snapshotted into the order notes below so a later
        // address change never rewrites the tax treatment of an already-issued invoice.
        await prisma.team.update({
            where: { id: teamId },
            data: { billingCountry: country, billingState: country === "IN" ? state : null }
        });

        // GST is added on top of the plan price for Indian customers; the customer
        // is charged taxableValue + taxAmount, not the bare plan price.
        const gst = computeGstExclusive(orderAmount, country, country === "IN" ? state : undefined);

        const currency = process.env['APP_CURRENCY'] || "USD";
        const order = await billingService.createOrder(
            gst.totalAmount,
            currency,
            `receipt_${Date.now()}`,
            {
                userId, teamId, priceId, planId: plan?.id, country, state: country === "IN" ? state : undefined,
                taxableValue: gst.taxableValue, taxAmount: gst.taxAmount, taxType: gst.taxType, taxRate: gst.taxRate
            }
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
