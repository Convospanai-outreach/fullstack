import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveBillingCurrency } from "@/modules/billing/service/gatewaySelector";

// Public: the /pricing page needs to show real prices before a visitor signs up.
// No team-specific data is returned, only plan definitions.
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const country = searchParams.get("country") || "IN";
        const currency = resolveBillingCurrency(country);

        const plans = await prisma.plan.findMany({ orderBy: { monthlyPrice: "asc" } });

        const priced = plans.map((plan) => {
            if (currency === "INR") {
                return { id: plan.id, name: plan.name, currency, amount: plan.monthlyPrice, creditsPerMonth: plan.creditsPerMonth, maxAgents: plan.maxAgents, features: plan.features };
            }
            const stripePrices = (plan.stripePrices as Record<string, { amount: number; stripePriceId: string }> | null) || {};
            const priceForCurrency = stripePrices[currency];
            return {
                id: plan.id,
                name: plan.name,
                currency,
                amount: priceForCurrency?.amount ?? null,
                available: Boolean(priceForCurrency),
                creditsPerMonth: plan.creditsPerMonth,
                maxAgents: plan.maxAgents,
                features: plan.features,
            };
        });

        return NextResponse.json({ currency, plans: priced });
    } catch (error) {
        console.error("[BILLING_PLANS]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
