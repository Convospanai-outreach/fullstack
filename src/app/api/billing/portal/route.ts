import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";

export async function POST(req: Request) {
    try {
        const ctx = await getCurrentContext();

        if (!ctx.userId) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        // Razorpay doesn't have a hosted customer portal.
        // We redirect to our billing dashboard where users see their history and credits.
        const url = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing`;

        return NextResponse.json({ url });
    } catch (error) {
        console.error("[BILLING_PORTAL]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
