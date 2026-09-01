import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { billingService } from "@/modules/billing/service/billingService";
import { authorizeRole, TeamRole } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { computeGstExclusive } from "@/lib/gst";

export async function POST(req: NextRequest) {
    const ctx = await getCurrentContext();
    if (!ctx.teamId || !ctx.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await authorizeRole(ctx.userId, ctx.teamId, TeamRole.ADMIN);

    const body = await req.json();
    const { tierId, state } = body;
    // Normalized so "in"/"In" is recognized as India for GST purposes, not
    // silently treated as a non-India zero-rated export.
    const country = typeof body.country === "string" ? body.country.trim().toUpperCase() : body.country;

    if (!country || typeof country !== "string") {
        return NextResponse.json({ error: "Billing country is required" }, { status: 400 });
    }
    if (country === "IN" && (!state || typeof state !== "string")) {
        return NextResponse.json({ error: "Billing state is required for India" }, { status: 400 });
    }

    // Amounts are in paise (smallest INR unit): rupee price * 100.
    const TIERS: Record<string, { amount: number; credits: number }> = {
        starter: { amount: 50000, credits: 500 }, // ₹500
        pro: { amount: 180000, credits: 2000 }, // ₹1800
        power: { amount: 800000, credits: 10000 } // ₹8000
    };

    const tier = TIERS[String(tierId || "").toLowerCase()];
    if (!tier) {
        return NextResponse.json({ error: "Invalid top-up tier" }, { status: 400 });
    }

    try {
        // GST is added on top of the tier's base price for Indian customers.
        const gst = computeGstExclusive(tier.amount, country, country === "IN" ? state : undefined);

        // Order creation (external Razorpay call) runs before persisting the billing
        // address - if it throws, the team's billing info must stay unchanged rather
        // than being left mutated with no corresponding order.
        const order = await billingService.createTopUpOrder(
            ctx.teamId,
            ctx.userId,
            gst.totalAmount,
            tier.credits,
            country,
            country === "IN" ? state : undefined,
            gst
        );

        await prisma.team.update({
            where: { id: ctx.teamId },
            data: { billingCountry: country, billingState: country === "IN" ? state : null }
        });

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
