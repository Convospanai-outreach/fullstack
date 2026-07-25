import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params: { trackingId: string } }) {
    // RFC 8058 Compliance: GET renders static HTML confirmation UI, 0 DB mutations
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Unsubscribe Confirmation — CraftMyFunnel</title>
</head>
<body style="background:#09090b;color:#fff;font-family:sans-serif;text-align:center;padding-top:4rem;">
    <h1>Confirm Unsubscribe</h1>
    <p style="color:#a1a1aa;">Are you sure you want to stop receiving emails?</p>
    <form method="POST" action="/api/email/unsubscribe/${params.trackingId}">
        <button type="submit" style="background:#4f46e5;color:#fff;border:none;padding:12px 24px;border-radius:8px;cursor:pointer;">Confirm Unsubscribe</button>
    </form>
</body>
</html>`;
    return new NextResponse(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function POST(req: NextRequest, { params }: { params: { trackingId: string } }) {
    try {
        const { recordEmailUnsubscribe } = await import("@/modules/email-campaigner/service/trackingService");
        await recordEmailUnsubscribe({ token: params.trackingId, headers: req.headers });
    } catch {
        return new NextResponse("Unsubscribe request recorded.", { status: 200 });
    }

    return new NextResponse("Unsubscribe request recorded.", { status: 200 });
}
