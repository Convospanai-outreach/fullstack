import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { billingService } from "@/modules/billing/service/billingService";

export async function POST(req: NextRequest) {
    const ctx = await getCurrentContext();
    if (!ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { amount, credits } = await req.json();

    if (!amount || !credits) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    try {
        const order = await billingService.createTopUpOrder(ctx.teamId, amount, credits);

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
