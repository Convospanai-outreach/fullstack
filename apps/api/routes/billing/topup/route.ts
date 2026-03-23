import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { billingService } from "@/modules/billing/service/billingService";

export async function POST(req: NextRequest) {
    const ctx = await getCurrentContext();
    if (!ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { tierId } = await req.json();

    const TIERS: Record<string, { amount: number; credits: number }> = {
        starter: { amount: 500, credits: 500 },
        pro: { amount: 1800, credits: 2000 },
        power: { amount: 8000, credits: 10000 }
    };

    const tier = TIERS[String(tierId || "").toLowerCase()];
    if (!tier) {
        return NextResponse.json({ error: "Invalid top-up tier" }, { status: 400 });
    }

    try {
        const order = await billingService.createTopUpOrder(ctx.teamId, tier.amount, tier.credits);

        return NextResponse.json({
            id: order.id,
            amount: order.amount,
            currency: order.currency,
            key: process.env['NEXT_PUBLIC_RAZORPAY_KEY_ID']
        });
    } catch (error: any) {
        console.error("Top-up error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
