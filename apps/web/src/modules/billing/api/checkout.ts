import { NextResponse } from "next/server";
import { billingService } from "../service/billingService";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { planId } = body;

        // Mock user ID
        const userId = "user_123";

        if (!planId) {
            return NextResponse.json({ ok: false, error: "Plan ID required" }, { status: 400 });
        }

        const session = await billingService.createOrder(10, "INR", "receipt", { planId, userId });
        return NextResponse.json({ ok: true, orderId: session.id, amount: session.amount, currency: session.currency });
    } catch (err: any) {
        return NextResponse.json(
            { ok: false, error: err.message },
            { status: 500 }
        );
    }
}

export async function GET() {
    try {
        const userId = "user_123";
        const status = await billingService.getSubscriptionStatus(userId);
        return NextResponse.json({ ok: true, status });
    } catch (err: any) {
        return NextResponse.json(
            { ok: false, error: err.message },
            { status: 500 }
        );
    }
}
