import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ trackingId: string }> }) {
    // RFC 8058 Compliance: GET renders static HTML confirmation UI, 0 DB mutations
    const { trackingId } = await params;

    if (!/^[a-zA-Z0-9\-_]+$/.test(trackingId)) {
        return new NextResponse("Invalid tracking ID", { status: 400 });
    }
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Unsubscribe Confirmation — CraftMyFunnel</title>
</head>
<body style="background:#09090b;color:#fff;font-family:sans-serif;text-align:center;padding-top:4rem;">
    <h1>Confirm Unsubscribe</h1>
    <p style="color:#a1a1aa;">Are you sure you want to stop receiving emails?</p>
    <form method="POST" action="/api/email/unsubscribe/${trackingId}">
        <button type="submit" style="background:#4f46e5;color:#fff;border:none;padding:12px 24px;border-radius:8px;cursor:pointer;">Confirm Unsubscribe</button>
    </form>
</body>
</html>`;
    return new NextResponse(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ trackingId: string }> }) {
    try {
        const { trackingId } = await params;
        
        if (!/^[a-zA-Z0-9\-_]+$/.test(trackingId)) {
            return new NextResponse("Invalid tracking ID", { status: 400 });
        }
        
        const { recordEmailUnsubscribe } = await import("@/modules/email-campaigner/service/trackingService");
        await recordEmailUnsubscribe({ token: trackingId, headers: req.headers });

        const email = await prisma.email.findFirst({
            where: { OR: [{ id: trackingId }, { trackingId }] },
            select: { leadId: true },
        });

        if (email?.leadId) {
            await prisma.lead.update({
                where: { id: email.leadId },
                data: { status: "OPT_OUT" },
            }).catch(() => undefined);
        }
    } catch {
        return new NextResponse("Unsubscribe request recorded.", { status: 200 });
    }

    return new NextResponse("Unsubscribe request recorded.", { status: 200 });
}
