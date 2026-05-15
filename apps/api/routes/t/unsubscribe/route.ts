import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { addSuppression, logEmailActivity } from "@/lib/emailTracking";

export async function GET(req: NextRequest) {
    const token = new URL(req.url).searchParams.get("token");
    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

    const email = await (prisma as any).email.findUnique({
        where: { trackingToken: token },
        include: { campaign: { select: { teamId: true } }, lead: { select: { email: true } } },
    });
    const recipient = email?.lead?.email;
    const teamId = email?.campaign?.teamId;
    if (!email || !recipient || !teamId) {
        return NextResponse.json({ error: "Invalid unsubscribe token" }, { status: 404 });
    }

    await addSuppression(teamId, recipient, "UNSUBSCRIBED", "EMAIL_LINK", { emailId: email.id });
    await logEmailActivity({
        teamId,
        emailId: email.id,
        campaignId: email.campaignId,
        leadId: email.leadId,
        messageId: email.providerId,
        eventType: "UNSUBSCRIBED",
        metadata: { source: "EMAIL_LINK" },
    });

    return new NextResponse("You have been unsubscribed.", {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
}

export async function POST(req: NextRequest) {
    return GET(req);
}

