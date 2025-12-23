import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { billingService } from "@/modules/billing/service/billingService";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const body = await req.json();
        const { priceId, amount } = body;
        // Map Price ID to Amount (Simple hardcoded map for now based on BillingPage)

        let orderAmount = 0;
        if (priceId && priceId.includes("price_")) {
            // Simplified mapping
            if (priceId.includes("price_1Q")) orderAmount = 29; // Pro
            // Logic needed.
            // Better: Pass amount from FE or look up Plan.
        }

        // Fallback: If amount passed directly (credits topup)
        if (amount) orderAmount = amount;

        // Hardcode for MVP if priceId matches Pro
        if (priceId) orderAmount = 29; // Placeholder

        if (orderAmount <= 0) {
            return new NextResponse("Invalid Amount", { status: 400 });
        }

        const order = await billingService.createOrder(
            orderAmount,
            "USD",
            `receipt_${Date.now()}`,
            { userId: session.user.id, priceId }
        );

        return NextResponse.json({ orderId: order.id, amount: order.amount, currency: order.currency, key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID });
    } catch (error) {
        console.error("[RAZORPAY_CHECKOUT]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
