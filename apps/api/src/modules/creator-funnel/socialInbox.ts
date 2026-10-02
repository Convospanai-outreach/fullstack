import { prisma } from "@/lib/db";
import { APIError } from "@/lib/apiResponse";
import { decryptCredential, type EncryptedCredential } from "@/lib/security/credentialVault";
import { GraphError, graphCall, graphPostJson } from "./metaGraph";

// Creator funnel DMs: Instagram Direct and Facebook Page messages arrive through one Meta
// webhook (routes/webhooks/meta-social) and land in the Action Inbox as Message rows on a lead.
// Replies go back through Meta's Send API from the inbox. Behind the creator-funnel flag on
// both sides. Platform rules checked 2026-10-01:
// - Payload: object "instagram" (entry.id = Instagram account id) or "page" (entry.id = Page
//   id); entry[].messaging[] has sender.id, recipient.id, timestamp and message { mid, text,
//   attachments, is_echo, is_deleted }.
//   https://developers.facebook.com/docs/messenger-platform/instagram/features/webhook
//   https://developers.facebook.com/documentation/business-messaging/messenger-platform/webhooks
// - Instagram send: POST /me/messages with a Page access token and instagram_manage_messages,
//   recipient={"id":IGSID}&message={"text":...}; "Message text must be UTF-8 and be 1,000 bytes
//   or less." https://developers.facebook.com/docs/messenger-platform/instagram/features/send-message
// - Facebook send: POST /{page-id}/messages with a Page access token and pages_messaging,
//   messaging_type RESPONSE, as a JSON body; the response has recipient_id and message_id.
//   https://developers.facebook.com/documentation/business-messaging/messenger-platform/send-messages
// - "Businesses have up to 24 hours to respond to a user." Replies outside that window would
//   need a message tag (HUMAN_AGENT needs its own permission), so CMf doesn't send them.
//   https://developers.facebook.com/documentation/business-messaging/messenger-platform/policy
//   ("Messenger Platform and IG Messaging API policy"). Instagram says the same: "Your app has
//   24 hours to respond to any message sent from an Instagram user to your app user."
//   https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api/
// - Profiles: GET /{IGSID}?fields=name,username (consent is set when the person messages the
//   business) and GET /{PSID}?fields=first_name,last_name (needs Business Asset User Profile
//   Access), both with the Page token.
//   https://developers.facebook.com/docs/messenger-platform/instagram/features/user-profile
//   https://developers.facebook.com/docs/messenger-platform/identity/user-profile

export const REPLY_WINDOW_MS = 24 * 60 * 60 * 1000;
export const INSTAGRAM_TEXT_MAX_BYTES = 1000;
const MAX_STORED_TEXT = 5000;

export type AccountPlatform = "INSTAGRAM" | "FACEBOOK_PAGE";
export type SocialMessagePlatform = "INSTAGRAM" | "FACEBOOK";

export const ACCOUNT_PLATFORM_FOR_OBJECT: Record<string, AccountPlatform> = { instagram: "INSTAGRAM", page: "FACEBOOK_PAGE" };
export const MESSAGE_PLATFORM: Record<AccountPlatform, SocialMessagePlatform> = { INSTAGRAM: "INSTAGRAM", FACEBOOK_PAGE: "FACEBOOK" };
const LEAD_SOURCE: Record<AccountPlatform, string> = { INSTAGRAM: "instagram_dm", FACEBOOK_PAGE: "facebook_dm" };
const MESSAGING_SCOPE: Record<AccountPlatform, string> = { INSTAGRAM: "instagram_manage_messages", FACEBOOK_PAGE: "pages_messaging" };
const PLATFORM_LABEL: Record<AccountPlatform, string> = { INSTAGRAM: "Instagram", FACEBOOK_PAGE: "Facebook" };
const ATTACHMENT_LABEL: Record<string, string> = { image: "Photo", video: "Video", audio: "Voice message", file: "File" };

type DmEvent =
    | { kind: "message"; platform: AccountPlatform; accountExternalId: string; senderId: string; mid: string; content: string; text: string; sentAt: Date }
    | { kind: "deleted"; platform: AccountPlatform; accountExternalId: string; mid: string };

// Lead media URLs are never stored: attachments become a placeholder like "[Photo]".
function messageContent(message: any) {
    const parts: string[] = [];
    if (message?.reply_to?.story) parts.push("[Replied to your story]");
    for (const attachment of Array.isArray(message?.attachments) ? message.attachments : []) {
        parts.push(`[${ATTACHMENT_LABEL[attachment?.type] ?? "Attachment"}]`);
    }
    const text = typeof message?.text === "string" ? message.text.trim() : "";
    if (text) parts.push(text);
    return (parts.join(" ") || "[Unsupported message]").slice(0, MAX_STORED_TEXT);
}

// Only new messages and deletions are handled. Echoes (the business's own sends, including
// CMf's), reactions, reads, postbacks and referrals are skipped.
export function extractDmEvents(body: any): DmEvent[] {
    const platform = ACCOUNT_PLATFORM_FOR_OBJECT[body?.object];
    if (!platform) return [];
    const events: DmEvent[] = [];
    for (const entry of Array.isArray(body?.entry) ? body.entry : []) {
        const accountExternalId = typeof entry?.id === "string" ? entry.id : String(entry?.id ?? "");
        for (const item of Array.isArray(entry?.messaging) ? entry.messaging : []) {
            const message = item?.message;
            const mid = typeof message?.mid === "string" ? message.mid : "";
            const senderId = typeof item?.sender?.id === "string" ? item.sender.id : "";
            if (!accountExternalId || !mid || !senderId || message?.is_echo || senderId === accountExternalId) continue;
            if (message.is_deleted) {
                events.push({ kind: "deleted", platform, accountExternalId, mid });
                continue;
            }
            const timestamp = Number(item?.timestamp);
            events.push({
                kind: "message",
                platform,
                accountExternalId,
                senderId,
                mid,
                content: messageContent(message),
                text: typeof message?.text === "string" ? message.text : "", // what the person typed; keyword triggers match on this only
                sentAt: Number.isFinite(timestamp) && timestamp > 0 ? new Date(timestamp) : new Date(),
            });
        }
    }
    return events;
}

export type ReceivingAccount = { id: string; teamId: string; platform: AccountPlatform; handle?: string | null };

// Every connected account row for this Instagram account / Page whose team has the creator
// funnel on. Two teams that both connected the same Page each get their own copy.
export async function receivingAccounts(platform: AccountPlatform, externalId: string): Promise<ReceivingAccount[]> {
    const accounts = await prisma.socialAccount.findMany({
        where: { platform, externalId, status: "CONNECTED" },
        select: { id: true, teamId: true, platform: true, handle: true },
    });
    const { isCreatorFunnelEnabled } = await import("./featureGate");
    const enabled: ReceivingAccount[] = [];
    for (const account of accounts) {
        if (await isCreatorFunnelEnabled(account.teamId)) enabled.push(account as ReceivingAccount);
    }
    return enabled;
}

const isUniqueViolation = (error: unknown) => (error as any)?.code === "P2002";

const CONTACT_SELECT = { id: true, leadId: true, name: true, handle: true } as const;

// `profile` comes from a comment the person made (keyword auto-replies): its lead source, and
// the @username or name the comment carried.
export async function findOrCreateContact(
    account: ReceivingAccount,
    senderId: string,
    profile: { source?: string; handle?: string | null; name?: string | null } = {}
) {
    const where = { socialAccountId_externalUserId: { socialAccountId: account.id, externalUserId: senderId } };
    const existing = await prisma.socialContact.findUnique({ where, select: CONTACT_SELECT });
    if (existing) return { contact: existing, isNew: false };
    const handle = profile.handle ?? null;
    const name = profile.name ?? null;
    try {
        const contact = await prisma.$transaction(async (tx) => {
            const lead = await tx.lead.create({
                data: { teamId: account.teamId, source: profile.source ?? LEAD_SOURCE[account.platform], status: "NEW", ...(name ?? handle ? { fullName: name ?? handle } : {}) },
                select: { id: true },
            });
            return tx.socialContact.create({
                data: { teamId: account.teamId, socialAccountId: account.id, externalUserId: senderId, leadId: lead.id, handle, name },
                select: CONTACT_SELECT,
            });
        });
        return { contact, isNew: true };
    } catch (error) {
        // Two deliveries for a brand-new contact at once: the other one created it.
        if (!isUniqueViolation(error)) throw error;
        const raced = await prisma.socialContact.findUnique({ where, select: CONTACT_SELECT });
        if (!raced) throw error;
        return { contact: raced, isNew: false };
    }
}

async function storeInbound(account: ReceivingAccount, event: Extract<DmEvent, { kind: "message" }>, now: Date) {
    const { contact, isNew } = await findOrCreateContact(account, event.senderId);
    let message: { id: string; leadId: string; createdAt: Date };
    try {
        message = await prisma.message.create({
            data: {
                leadId: contact.leadId,
                content: event.content,
                direction: "INBOUND",
                platform: MESSAGE_PLATFORM[account.platform],
                sender: contact.name ?? contact.handle ?? null,
                status: "received",
                externalId: `${account.id}:${event.mid}`,
            },
            select: { id: true, leadId: true, createdAt: true },
        });
    } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        // Meta retried a delivery we already stored. The auto-reply claim is idempotent, so make
        // sure it was queued (the first attempt may have failed after storing the message).
        await queueDmAutoReply(account, event, contact.leadId, now);
        return false;
    }

    // The reply window runs from the person's latest message. A timestamp from the future
    // can't stretch it.
    const sentAt = event.sentAt > now ? now : event.sentAt;
    await prisma.socialContact.updateMany({
        where: { id: contact.id, OR: [{ lastInboundAt: null }, { lastInboundAt: { lt: sentAt } }] },
        data: { lastInboundAt: sentAt },
    });

    if (isNew) {
        try {
            const { applyFunnelEvent } = await import("./funnelStageService");
            await applyFunnelEvent(account.teamId, contact.leadId, "social_first_touch");
        } catch (error) {
            console.error("[MetaSocial] Funnel stage update failed:", error instanceof Error ? error.message : error);
        }
        void fillContactProfile(contact.id);
    }

    const { onInboundReply } = await import("@/modules/inbox/inboundReplyNotifier");
    void onInboundReply({ ...message, sentimentScore: null, emailEventId: null });
    await queueDmAutoReply(account, event, contact.leadId, now);
    return true;
}

// A keyword auto-reply for this DM, when one of the account's active triggers matches.
// keywordTriggers.ts only queues it; the worker sends it.
async function queueDmAutoReply(account: ReceivingAccount, event: Extract<DmEvent, { kind: "message" }>, leadId: string, now: Date) {
    const { queueDmReply } = await import("./keywordTriggers");
    if (!event.text.trim()) return;
    await queueDmReply(account, { mid: event.mid, senderId: event.senderId, text: event.text, leadId }, now);
}

// Handles one verified webhook delivery: DMs (messaging[]) and comments (changes[]). Each event
// is independent: one failing doesn't stop the rest. Returns how many messages were stored and
// how many events failed. Comments are only checked against keyword triggers, not stored.
export async function ingestMetaWebhook(body: unknown, now = new Date()) {
    const events = extractDmEvents(body);
    const { extractCommentEvents, queueCommentReplies } = await import("./keywordTriggers");
    const comments = extractCommentEvents(body);
    let stored = 0;
    let failed = 0;
    for (const comment of comments) {
        try {
            await queueCommentReplies(comment, await receivingAccounts(comment.platform, comment.accountExternalId), now);
        } catch (error) {
            failed++;
            console.error("[MetaSocial] Comment event failed:", error instanceof Error ? error.message : error);
        }
    }
    for (const event of events) {
        try {
            const accounts = await receivingAccounts(event.platform, event.accountExternalId);
            if (event.kind === "deleted") {
                // The person deleted their message: delete CMf's copy too.
                await prisma.message.deleteMany({
                    where: { direction: "INBOUND", externalId: { in: accounts.map((account) => `${account.id}:${event.mid}`) } },
                });
                continue;
            }
            for (const account of accounts) {
                if (await storeInbound(account, event, now)) stored++;
            }
        } catch (error) {
            failed++;
            console.error("[MetaSocial] Webhook event failed:", error instanceof Error ? error.message : error);
        }
    }
    return { events: events.length + comments.length, stored, failed };
}

export type TokenAccount = {
    teamId: string;
    platform: string;
    parentExternalId: string | null;
    status: string;
    encryptedToken: unknown;
};

// DMs use the Page access token for both platforms: a Page's own row, or for Instagram the row
// of the Page it's linked through (same team, still connected).
export async function pageTokenFor(account: TokenAccount) {
    const page =
        account.platform === "FACEBOOK_PAGE"
            ? account
            : account.parentExternalId
              ? await prisma.socialAccount.findFirst({
                    where: { teamId: account.teamId, platform: "FACEBOOK_PAGE", externalId: account.parentExternalId },
                    select: { status: true, encryptedToken: true },
                })
              : null;
    if (!page || page.status !== "CONNECTED" || !page.encryptedToken) return null;
    return (await decryptCredential(page.encryptedToken as EncryptedCredential).catch(() => undefined)) ?? null;
}

export function plainName(value: unknown, max: number) {
    return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "";
}

// Best effort, after the webhook has stored the message: fills in the person's name/handle.
export async function fillContactProfile(contactId: string) {
    try {
        const contact = await prisma.socialContact.findUnique({
            where: { id: contactId },
            select: {
                id: true,
                leadId: true,
                externalUserId: true,
                socialAccount: { select: { teamId: true, platform: true, parentExternalId: true, status: true, encryptedToken: true } },
            },
        });
        if (!contact) return;
        const token = await pageTokenFor(contact.socialAccount);
        if (!token) return;

        const instagram = contact.socialAccount.platform === "INSTAGRAM";
        const profile = await graphCall(
            "GET",
            encodeURIComponent(contact.externalUserId),
            { fields: instagram ? "name,username" : "first_name,last_name" },
            token
        );
        const username = instagram ? plainName(profile?.username, 60).replace(/^@/, "") : "";
        const handle = username ? `@${username}` : null;
        const name = plainName(instagram ? profile?.name : [profile?.first_name, profile?.last_name].filter(Boolean).join(" "), 100) || null;
        if (!handle && !name) return;

        await prisma.socialContact.update({ where: { id: contact.id }, data: { handle, name } });
        await prisma.lead.updateMany({ where: { id: contact.leadId, fullName: null }, data: { fullName: name ?? handle } });
    } catch (error) {
        console.error("[MetaSocial] Profile lookup failed:", error instanceof Error ? error.message : error);
    }
}

// The inbox reply path for an Instagram/Facebook conversation (actionInboxService.sendReply).
export async function sendSocialReply(
    input: { teamId: string; userId: string; leadId: string; replyMessageId: string; platform: SocialMessagePlatform; content: string },
    now = new Date()
) {
    const { teamId, userId, leadId, content } = input;
    const { isCreatorFunnelEnabled } = await import("./featureGate");
    if (!(await isCreatorFunnelEnabled(teamId))) {
        throw new APIError("Instagram and Facebook replies aren't turned on for this team", 403, "FEATURE_DISABLED");
    }

    const platform: AccountPlatform = input.platform === "INSTAGRAM" ? "INSTAGRAM" : "FACEBOOK_PAGE";
    const label = PLATFORM_LABEL[platform];
    const contact = await prisma.socialContact.findFirst({
        where: { teamId, leadId, socialAccount: { platform } },
        orderBy: { lastInboundAt: "desc" },
        select: {
            externalUserId: true,
            lastInboundAt: true,
            socialAccount: {
                select: { id: true, teamId: true, platform: true, externalId: true, parentExternalId: true, status: true, encryptedToken: true, scopes: true },
            },
        },
    });
    if (!contact) throw new APIError("Conversation not found", 404, "CONTACT_NOT_FOUND");
    const account = contact.socialAccount;
    if (account.status !== "CONNECTED") {
        throw new APIError(`This ${label} account is disconnected. Reconnect it in Settings to reply.`, 409, "ACCOUNT_DISCONNECTED");
    }
    if (!contact.lastInboundAt || now.getTime() - contact.lastInboundAt.getTime() > REPLY_WINDOW_MS) {
        throw new APIError(
            `${label} only allows replies within 24 hours of the person's last message. You can reply once they message you again.`,
            409,
            "REPLY_WINDOW_CLOSED"
        );
    }
    if (platform === "INSTAGRAM" && Buffer.byteLength(content, "utf8") > INSTAGRAM_TEXT_MAX_BYTES) {
        throw new APIError("Instagram messages can be at most 1,000 bytes (emoji and accented letters count as more than one).", 400, "MESSAGE_TOO_LONG");
    }
    if (!account.scopes.includes(MESSAGING_SCOPE[platform])) {
        throw new APIError(`Reconnect this ${label} account and allow messaging to reply from CMf.`, 409, "MISSING_PERMISSION");
    }

    const { guardrailService } = await import("@/modules/governance/service/guardrailService");
    const validation = await guardrailService.evaluate(teamId, content);
    if (!validation.isSafe) {
        throw new APIError(validation.violations[0]?.reason || "Content blocked by guardrails", 403, "GUARDRAIL_BLOCKED");
    }

    const token = await pageTokenFor(account);
    if (!token) {
        throw new APIError("The Facebook Page this account uses isn't connected. Reconnect it in Settings to reply.", 409, "PAGE_DISCONNECTED");
    }

    let result: any;
    try {
        // Each request in the shape its own doc shows: Instagram form-encoded, Messenger JSON.
        result =
            platform === "INSTAGRAM"
                ? await graphCall("POST", "me/messages", { recipient: JSON.stringify({ id: contact.externalUserId }), message: JSON.stringify({ text: content }) }, token)
                : await graphPostJson(
                      `${encodeURIComponent(account.externalId)}/messages`,
                      { recipient: { id: contact.externalUserId }, messaging_type: "RESPONSE", message: { text: content } },
                      token
                  );
    } catch (error) {
        // Not recorded as sent either way. When Meta didn't answer, it may still have delivered it.
        if (error instanceof GraphError && error.uncertain) {
            throw new APIError(`${label} didn't confirm the message was sent. Check the conversation in ${label} before sending again.`, 502, "SEND_UNCONFIRMED");
        }
        throw new APIError(error instanceof GraphError ? `${label} refused the message: ${error.message}` : "Failed to send reply", 502, "SEND_FAILED");
    }

    const mid = typeof result?.message_id === "string" ? result.message_id : null;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    const sent = await prisma.message.create({
        data: {
            leadId,
            content,
            direction: "OUTBOUND",
            platform: input.platform,
            sender: user?.name || "Me",
            status: "sent",
            isRead: true,
            externalId: mid ? `${account.id}:${mid}` : null,
        },
    });
    await prisma.message.update({ where: { id: input.replyMessageId }, data: { isRead: true } });
    return sent;
}
