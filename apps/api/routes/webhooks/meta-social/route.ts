import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { logger } from "@/lib/logger";

// Creator funnel DMs: one callback URL for the Meta app's "instagram" and "page" webhook
// objects (Instagram Direct and Facebook Page messages). Behind the creator-funnel flag, which
// socialInbox.ts checks per receiving team. Checked 2026-10-01 against
// https://developers.facebook.com/docs/graph-api/webhooks/getting-started:
// - Verification is a GET with hub.mode=subscribe, hub.verify_token and hub.challenge; reply
//   with the challenge.
// - Every POST is signed: X-Hub-Signature-256 is "sha256=" + the HMAC-SHA256 of the payload
//   with the app secret. Unsigned or mismatched deliveries are rejected before parsing.
// - Respond 200 quickly; Meta batches updates and retries failed deliveries, so storing is
//   idempotent (Message.externalId) and no Graph call happens before the reply.
// The signed bytes reach this handler intact because server.ts keeps the raw body for this
// path (src/lib/rawJsonBody.ts).

function sameSecret(provided: string, expected: string) {
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const verifyToken = process.env["META_WEBHOOK_VERIFY_TOKEN"];
    if (!verifyToken) {
        logger.error("[Meta Social Webhook] META_WEBHOOK_VERIFY_TOKEN is not configured.");
        return new NextResponse("Webhook not configured", { status: 503 });
    }

    const challenge = searchParams.get("hub.challenge");
    if (searchParams.get("hub.mode") === "subscribe" && challenge && sameSecret(searchParams.get("hub.verify_token") ?? "", verifyToken)) {
        return new NextResponse(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
    }
    return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
    const appSecret = process.env["FACEBOOK_APP_SECRET"];
    if (!appSecret) {
        logger.error("[Meta Social Webhook] FACEBOOK_APP_SECRET is not configured.");
        return new NextResponse("Webhook not configured", { status: 503 });
    }

    const rawBody = Buffer.from(await req.arrayBuffer());
    const signature = req.headers.get("x-hub-signature-256");
    const expected = `sha256=${crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
    if (!signature || !sameSecret(signature, expected)) {
        return new NextResponse("Invalid signature", { status: 401 });
    }

    let body: unknown;
    try {
        body = JSON.parse(rawBody.toString("utf8"));
    } catch {
        return new NextResponse("Invalid JSON", { status: 400 });
    }

    try {
        const { ingestMetaWebhook } = await import("@/modules/creator-funnel/socialInbox");
        const result = await ingestMetaWebhook(body);
        // A non-200 makes Meta retry the delivery; messages already stored are skipped then.
        if (result.failed > 0) return new NextResponse("Some events failed", { status: 500 });
        return NextResponse.json({ status: "ok" });
    } catch (error) {
        logger.error("[Meta Social Webhook] Error processing delivery", error);
        return new NextResponse("Webhook Handler Failed", { status: 500 });
    }
}
