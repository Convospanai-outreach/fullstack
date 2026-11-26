import { NextRequest, NextResponse } from "next/server";

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

export async function POST(_req: NextRequest, { params }: { params: Promise<{ trackingId: string }> }) {
    const { trackingId } = await params;
    if (!/^[A-Za-z0-9._~-]{8,200}$/.test(trackingId)) {
        return new NextResponse("Unsubscribe request recorded.", { status: 200 });
    }
    const origin = process.env["API_INTERNAL_ORIGIN"] || process.env["API_BASE_URL"] || "http://localhost:3001";
    try {
        const response = await fetch(new URL("/email/unsubscribe/" + encodeURIComponent(trackingId), origin), {
            method: "POST",
            redirect: "error",
            signal: AbortSignal.timeout(10_000),
        });
        if (response.ok) return new NextResponse("Unsubscribe request recorded.", { status: 200 });
    } catch {
        // The mailbox provider can retry a failed request.
    }
    return new NextResponse("Could not process unsubscribe request. Please retry.", { status: 503 });
}
