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

export async function GET(req: NextRequest, { params }: { params: Promise<{ trackingId: string }> }) {
    // RFC 8058 Compliance: GET must NOT mutate database state to prevent antivirus scanner mass-unsubscribes.
    // Renders a clean HTML confirmation page requiring a human click.
    const { trackingId } = await params;
    const safeTrackingId = encodeURIComponent(trackingId);
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Unsubscribe Confirmation — CraftMyFunnel</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #09090b; color: #f4f4f5; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
        .card { background: #18181b; border: 1px solid #27272a; padding: 2.5rem; border-radius: 1rem; max-width: 420px; text-align: center; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); }
        h1 { font-size: 1.25rem; font-weight: 600; margin-bottom: 0.75rem; color: #fff; }
        p { font-size: 0.875rem; color: #a1a1aa; margin-bottom: 1.5rem; line-height: 1.5; }
        button { background: #4f46e5; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 0.5rem; font-weight: 600; font-size: 0.875rem; cursor: pointer; transition: background 0.2s; }
        button:hover { background: #4338ca; }
    </style>
</head>
<body>
    <div class="card">
        <h1>Confirm Unsubscribe</h1>
        <p>Are you sure you want to stop receiving outreach emails from this campaign?</p>
        <form method="POST" action="/api/email/unsubscribe/${safeTrackingId}">
            <button type="submit">Confirm Unsubscribe</button>
        </form>
    </div>
</body>
</html>`;

    return new NextResponse(html, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
    });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ trackingId: string }> }) {
    // RFC 8058 One-Click HTTP POST handler: Mutates database state & upserts suppression entry
    try {
        const { trackingId } = await params;
        await processUnsubscribe(trackingId);
    } catch {
        return new NextResponse("Unsubscribe request recorded.", { status: 200 });
    }

    return new NextResponse("Unsubscribe request recorded.", { status: 200 });
}
