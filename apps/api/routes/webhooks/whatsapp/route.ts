import { NextRequest, NextResponse } from "next/server";
import { logWebhookRejected } from "@/lib/webhookRejection";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { advanceLeadAfterReply } from "@/lib/crm/leadStageTransitions";
import { logger } from "@/lib/logger";
import { ConsentService } from "@/modules/whatsapp/ConsentService";

// Standard WhatsApp/SMS opt-out keywords (exact match after trim/lowercase, not
// substring - "please stop calling" should not revoke consent).
const OPT_OUT_KEYWORDS = new Set(["stop", "unsubscribe", "opt out", "optout"]);

// Anyone who messages a team's number becomes a lead, so a flood of strangers would flood the team's
// lead list. Past this many inbound-created leads in 24 hours the message is logged and dropped.
// Soft cap: the lock below is per number, so a burst of different numbers can overshoot a little.
const INBOUND_LEADS_PER_TEAM_PER_DAY = Math.max(1, Number(process.env["WHATSAPP_INBOUND_LEADS_PER_DAY"]) || 200);

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
    logWebhookRejected(req, "whatsapp", "invalid_verify_token");
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

// WhatsApp's own display name for the sender, from the payload's contacts list.
function senderProfileName(value: any, fromPhone: string): string | null {
    const contacts = Array.isArray(value?.contacts) ? value.contacts : [];
    const contact = contacts.find((c: any) => c?.wa_id === fromPhone) ?? contacts[0];
    const name = contact?.profile?.name;
    return typeof name === "string" && name.trim() ? name.trim().slice(0, 120) : null;
}

async function resolveLeadForInboundMessage(
    phoneNumberId: string,
    fromPhone: string,
    options: { text: string; profileName: string | null },
) {
    const team = await prisma.team.findFirst({
        where: { whatsappPhoneNumberId: phoneNumberId },
        select: { id: true },
    });
    if (!team) return null;

    const suffix = phoneSuffix(fromPhone);
    if (!suffix) return null;

    const existing = await prisma.lead.findFirst({
        where: { teamId: team.id, phone: { endsWith: suffix } },
        select: { id: true, teamId: true },
    });
    if (existing) return existing;

    // Someone we don't have yet wrote to the team's number: they become a lead so the reply lands in
    // the inbox and the pipeline. An opt-out from a stranger is not worth a record. No WhatsApp
    // outreach consent is recorded: messaging us first doesn't opt them in, so sequence sends stay
    // blocked. Replies through the send route are allowed for 24 hours (recordInboundReplyWindow).
    if (OPT_OUT_KEYWORDS.has(options.text.trim().toLowerCase())) return null;
    // Two webhooks for the same new sender (Meta retries, or two quick messages) can both reach this point.
    // Lead has no unique key on the phone, so serialise per team and number and look again under the lock;
    // the second one then finds the lead the first just made instead of creating a duplicate.
    return prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(7403, hashtext(${`${team.id}:${suffix}`}))`;
        const raced = await tx.lead.findFirst({
            where: { teamId: team.id, phone: { endsWith: suffix } },
            select: { id: true, teamId: true },
        });
        if (raced) return raced;
        const createdToday = await tx.lead.count({
            where: { teamId: team.id, source: "WHATSAPP_INBOUND", createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        });
        if (createdToday >= INBOUND_LEADS_PER_TEAM_PER_DAY) {
            logger.warn(`[WhatsApp Webhook] Team ${team.id} reached ${INBOUND_LEADS_PER_TEAM_PER_DAY} inbound leads in 24h; not creating another`);
            return null;
        }
        return tx.lead.create({
            data: {
                teamId: team.id,
                phone: `+${fromPhone.replace(/\D/g, "")}`,
                fullName: options.profileName,
                source: "WHATSAPP_INBOUND",
                status: "NEW",
            },
            select: { id: true, teamId: true },
        });
    });
}

export async function POST(req: NextRequest) {
    const rawBody = await req.text();

    const appSecret = process.env["WHATSAPP_APP_SECRET"];
    if (!appSecret) {
        logger.error("[WhatsApp Webhook] WHATSAPP_APP_SECRET is not configured.");
        return new NextResponse("Webhook not configured", { status: 503 });
    }

    const signatureHeader = req.headers.get("x-hub-signature-256");
    if (!signatureHeader) {
        logWebhookRejected(req, "whatsapp", "missing_signature", rawBody.length);
        return new NextResponse("Missing signature", { status: 400 });
    }
    const expected = `sha256=${crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
    const expectedBuffer = Buffer.from(expected);
    const providedBuffer = Buffer.from(signatureHeader);
    if (expectedBuffer.length !== providedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, providedBuffer)) {
        logWebhookRejected(req, "whatsapp", "invalid_signature", rawBody.length);
        return new NextResponse("Invalid signature", { status: 400 });
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

                    const text = typeof message?.text?.body === "string" ? message.text.body : `[${message?.type || "unknown"} message]`;
                    const lead = await resolveLeadForInboundMessage(phoneNumberId, fromPhone, {
                        text,
                        profileName: senderProfileName(value, fromPhone),
                    });
                    if (!lead) {
                        logger.warn(`[WhatsApp Webhook] No lead for inbound message from ${fromPhone}`);
                        continue;
                    }

                    const stored = await prisma.whatsAppMessage.create({
                        data: { leadId: lead.id, body: text, direction: "INBOUND", status: "received" },
                    });

                    if (stored?.id) {
                        const { updateFollowUpForInbound } = await import("@/modules/inbox/inboundReplyNotifier");
                        await updateFollowUpForInbound({ id: stored.id, leadId: lead.id, content: text }, "whatsapp");
                    }
                    if (OPT_OUT_KEYWORDS.has(text.trim().toLowerCase())) {
                        try {
                            await ConsentService.revokeConsent(lead.id, undefined, "WhatsApp inbound opt-out keyword", "WHATSAPP");
                        } catch (consentError) {
                            logger.error("[WhatsApp Webhook] Failed to revoke consent after opt-out keyword", consentError);
                        }
                        continue;
                    }

                    try {
                        await ConsentService.recordInboundReplyWindow(lead.id);
                    } catch (consentError) {
                        logger.error("[WhatsApp Webhook] Failed to record the reply window", consentError);
                    }

                    try {
                        await advanceLeadAfterReply(prisma, { leadId: lead.id, teamId: lead.teamId });
                    } catch {
                        // Lead-stage advancement is best-effort - the message is already recorded.
                    }

                    // The reply only marks the lead REPLIED. Whether it shows buying interest (and so makes the
                    // lead HOT) is judged by a queued job. Only real text is judged, not "[image message]" placeholders.
                    if (stored?.id && typeof message?.text?.body === "string") {
                        const { enqueueWhatsAppReplyClassification } = await import("@/modules/whatsapp/whatsappReplyClassification");
                        await enqueueWhatsAppReplyClassification({ id: stored.id, leadId: lead.id });
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
