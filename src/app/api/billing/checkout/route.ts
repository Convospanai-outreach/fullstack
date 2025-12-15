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

    const { amount, currency = "INR", receipt = "receipt#1", type = "topup" } = await req.json();

    if (!amount) {
        return new NextResponse("Amount is required", { status: 400 });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email }
        });
        if (!user) return new NextResponse("User not found", { status: 404 });

        // Retrieve team to link meta
        const membership = await prisma.teamMember.findFirst({
            where: { userId: user.id },
            select: { teamId: true }
        });

        const notes = {
            userId: user.id,
            teamId: membership?.teamId || "unknown",
            paymentType: type
        };

        const order = await billingService.createOrder(amount, currency, receipt, notes);

        return NextResponse.json({
            id: order.id,
            currency: order.currency,
            amount: order.amount,
            key: process.env.RAZORPAY_KEY_ID
        });

    } catch (error) {
        console.error("Razorpay Order Creation Error:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
