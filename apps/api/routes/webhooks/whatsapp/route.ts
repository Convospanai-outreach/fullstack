import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { advanceLeadAfterReply } from "@/lib/crm/leadStageTransitions";
import { logger } from "@/lib/logger";

// One Meta App (and one webhook subscription) serves every team's WhatsApp
// Business number - Meta routes all subscribed numbers' events to this single
// callback URL, so the verify token and signing secret are app-level env vars,
// not per-team like the Resend mailbox webhook secret.
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get("hub.mode");
    const token = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");

    const verifyToken = process.env["WHATSAPP_WEBHOOK_VERIFY_TOKEN"];
    if (!verifyToken) {
        logger.error("[WhatsApp Webhook] WHATSAPP_WEBHOOK_VERIFY_TOKEN is not configured.");
        return new NextResponse("Webhook not configured", { status: 503 });
    }

    if (mode === "subscribe" && token === verifyToken && challenge) {
        return new NextResponse(challenge, { status: 200 });
    }
    return new NextResponse("Forbidden", { status: 403 });
}

// Meta sends the "from"/recipient_id phone number without a leading "+" (e.g.
// "919876543210"); stored Lead.phone values aren't normalized at capture time
// and may carry a "+", spaces, or a "00" prefix. Comparing trailing digits
// instead of an exact string avoids missing a match over formatting alone.
function phoneSuffix(value: string | null | undefined): string {
    if (!value) return "";
    return value.replace(/\D/g, "").slice(-10);
}

async function resolveLeadForInboundMessage(phoneNumberId: string, fromPhone: string) {
    const team = await prisma.team.findFirst({
        where: { whatsappPhoneNumberId: phoneNumberId },
        select: { id: true },
    });
    if (!team) return null;

    const suffix = phoneSuffix(fromPhone);
    if (!suffix) return null;

    return prisma.lead.findFirst({
        where: { teamId: team.id, phone: { endsWith: suffix } },
        select: { id: true, teamId: true },
    });
}

export async function POST(req: NextRequest) {
    const rawBody = await req.text();

    const appSecret = process.env["WHATSAPP_APP_SECRET"];
    if (appSecret) {
        const signatureHeader = req.headers.get("x-hub-signature-256");
        if (!signatureHeader) {
            return new NextResponse("Missing signature", { status: 400 });
        }
        const expected = `sha256=${crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
        const expectedBuffer = Buffer.from(expected);
        const providedBuffer = Buffer.from(signatureHeader);
        if (expectedBuffer.length !== providedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, providedBuffer)) {
            return new NextResponse("Invalid signature", { status: 400 });
        }
    } else {
        logger.warn("[WhatsApp Webhook] WHATSAPP_APP_SECRET is not configured - accepting unsigned payloads.");
    }

    let body: any;
    try {
        body = JSON.parse(rawBody);
    } catch {
        return new NextResponse("Invalid JSON", { status: 400 });
    }

    try {
        const entries = Array.isArray(body?.entry) ? body.entry : [];
        for (const entry of entries) {
            const changes = Array.isArray(entry?.changes) ? entry.changes : [];
            for (const change of changes) {
                if (change?.field !== "messages") continue;
                const value = change?.value;
                const phoneNumberId = value?.metadata?.phone_number_id;
                const messages = Array.isArray(value?.messages) ? value.messages : [];
                if (!phoneNumberId || messages.length === 0) continue;

                for (const message of messages) {
                    const fromPhone = message?.from;
                    if (!fromPhone) continue;

                    const lead = await resolveLeadForInboundMessage(phoneNumberId, fromPhone);
                    if (!lead) {
                        logger.warn(`[WhatsApp Webhook] No matching lead for inbound message from ${fromPhone}`);
                        continue;
                    }

                    const text = typeof message?.text?.body === "string" ? message.text.body : `[${message?.type || "unknown"} message]`;
                    await prisma.whatsAppMessage.create({
                        data: { leadId: lead.id, body: text, direction: "INBOUND", status: "received" },
                    });

                    try {
                        await advanceLeadAfterReply(prisma, { leadId: lead.id, teamId: lead.teamId });
                    } catch {
                        // Lead-stage advancement is best-effort - the message is already recorded.
                    }
                }

                // "statuses" delivery/read receipts for outbound sends aren't handled here:
                // WhatsAppMessage has no provider-message-id column to correlate a receipt
                // back to the specific row it belongs to.
            }
        }

        return NextResponse.json({ status: "ok" });
    } catch (error) {
        logger.error("[WhatsApp Webhook] Error processing event", error);
        return new NextResponse("Webhook Handler Failed", { status: 500 });
    }
}
