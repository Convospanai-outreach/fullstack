import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { ingestMauticWebhook, verifyMauticSignature } from "@/modules/creator-funnel/mauticSubmission";

// Mautic "Form submitted" webhook (creator funnel return path). Signed with Webhook-Signature
// (base64 HMAC-SHA256 of the raw body) using MAUTIC_WEBHOOK_SECRET; server.ts keeps the raw
// bytes for this path (src/lib/rawJsonBody.ts). Details and sources: mauticSubmission.ts.
export async function POST(req: NextRequest) {
    const secret = process.env["MAUTIC_WEBHOOK_SECRET"];
    if (!secret) {
        logger.error("[Mautic Webhook] MAUTIC_WEBHOOK_SECRET is not configured.");
        return new NextResponse("Webhook not configured", { status: 503 });
    }

    const rawBody = Buffer.from(await req.arrayBuffer());
    if (!verifyMauticSignature(rawBody, req.headers.get("webhook-signature"), secret)) {
        return new NextResponse("Invalid signature", { status: 401 });
    }

    let body: unknown;
    try {
        body = JSON.parse(rawBody.toString("utf8"));
    } catch {
        return new NextResponse("Invalid JSON", { status: 400 });
    }

    try {
        const result = await ingestMauticWebhook(body);
        // A non-2xx makes Mautic retry the delivery; the merge and later steps are idempotent.
        if (result.failed > 0) return new NextResponse("Some submissions failed", { status: 500 });
        return NextResponse.json({ status: "ok", ...result });
    } catch (error) {
        logger.error("[Mautic Webhook] Error processing delivery", error);
        return new NextResponse("Webhook Handler Failed", { status: 500 });
    }
}
