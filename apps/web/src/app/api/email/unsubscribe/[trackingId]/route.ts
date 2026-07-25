import { NextRequest, NextResponse } from "next/server";

async function processUnsubscribe(trackingId: string) {
    const { prisma } = await import("@/lib/db");
    const email = await prisma.email.findFirst({
        where: { OR: [{ id: trackingId }, { trackingId }] },
        select: { id: true, leadId: true, campaignId: true, lead: { select: { email: true, teamId: true } } },
    });

    if (email && email.lead?.email && email.lead.teamId) {
        const teamId: string = email.lead.teamId;
        const recipientEmail: string = email.lead.email.toLowerCase().trim();

        await prisma.suppressionEntry.upsert({
            where: { teamId_email: { teamId, email: recipientEmail } },
            create: {
                teamId,
                email: recipientEmail,
                reason: "UNSUBSCRIBE",
                source: "RFC8058_ONE_CLICK",
                leadId: email.leadId,
            },
            update: {
                reason: "UNSUBSCRIBE",
                source: "RFC8058_ONE_CLICK",
                leadId: email.leadId,
            },
        });

        await prisma.lead.update({
            where: { id: email.leadId },
            data: { status: "OPT_OUT" },
        }).catch(() => undefined);

        await prisma.email.update({
            where: { id: email.id },
            data: { unsubscribedAt: new Date(), status: "unsubscribed" },
        }).catch(() => undefined);
    }
}

export async function GET(req: NextRequest, { params }: { params: { trackingId: string } }) {
    try {
        await processUnsubscribe(params.trackingId);
    } catch {
        return new NextResponse("Unsubscribe request recorded.", { status: 200 });
    }

    return new NextResponse("Unsubscribe request recorded.", { status: 200 });
}

export async function POST(req: NextRequest, { params }: { params: { trackingId: string } }) {
    try {
        await processUnsubscribe(params.trackingId);
    } catch {
        return new NextResponse("Unsubscribe request recorded.", { status: 200 });
    }

    return new NextResponse("Unsubscribe request recorded.", { status: 200 });
}
