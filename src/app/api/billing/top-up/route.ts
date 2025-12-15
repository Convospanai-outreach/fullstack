import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { billingService } from "@/modules/billing/service/billingService";

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const { amount, receipt = "topup#1" } = await req.json();

    if (!amount) {
        return new NextResponse("Amount is required (in INR)", { status: 400 });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: { memberships: { take: 1 } }
        });

        if (!user) return new NextResponse("User not found", { status: 404 });

        const teamId = user.memberships[0]?.teamId || "unknown";

        const notes = {
            userId: user.id,
            teamId: teamId,
            paymentType: "topup"
        };

        const order = await billingService.createOrder(amount, "INR", receipt, notes);

        return NextResponse.json({
            id: order.id,
            currency: order.currency,
            amount: order.amount,
            key: process.env.RAZORPAY_KEY_ID
        });

    } catch (error) {
        console.error("Top-up Order Error:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
