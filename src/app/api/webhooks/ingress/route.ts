import { NextRequest, NextResponse } from "next/server";
import { IdentityService } from "@/modules/identity/IdentityService";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
    logger.info("[Webhook Ingress] Received payload...");

    // 1. Extract Signature
    const signature = req.headers.get("X-Compliance-Hash");
    if (!signature) {
        logger.warn("[Webhook Ingress] Missing Signature");
        return NextResponse.json({ error: "Unauthorized: Missing Signature" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const secret = process.env['WEBHOOK_SECRET'] || "default-secret-dev";

        // 2. Verify Identity/Integrity
        const isValid = IdentityService.verifyWebhook(body, signature, secret);

        if (!isValid) {
            logger.warn("[Webhook Ingress] Invalid Signature");
            return NextResponse.json({ error: "Unauthorized: Invalid Signature" }, { status: 403 });
        }

        logger.info("[Webhook Ingress] Signature Verified. Processing...");

        // 3. Process Payload (Integration with Event Store or Agent)
        // For now, we just acknowledge receipt

        return NextResponse.json({ status: "Received", timestamp: new Date().toISOString() });

    } catch (e: any) {
        logger.error("[Webhook Ingress] Error processing request", e);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
