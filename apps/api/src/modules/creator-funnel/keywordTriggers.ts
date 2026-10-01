import { prisma } from "@/lib/db";
import { decryptCredential, type EncryptedCredential } from "@/lib/security/credentialVault";
import { GraphError, graphCall, graphPostJson } from "./metaGraph";
import {
    ACCOUNT_PLATFORM_FOR_OBJECT,
    MESSAGE_PLATFORM,
    REPLY_WINDOW_MS,
    findOrCreateContact,
    pageTokenFor,
    plainName,
    type AccountPlatform,
    type ReceivingAccount,
} from "./socialInbox";

// Creator funnel keyword auto-replies. A comment or DM containing one of an active trigger's
// keywords queues one reply (a KeywordTriggerReply row, unique per comment / DM); the worker
// sends it a few seconds later, so no Graph call happens inside the webhook request. A trigger
// only sends after someone switched it on. Platform rules checked 2026-10-01:
// - Comment webhooks: Instagram "comments" field (value.from {id, username}, value.media.id,
//   value.id, value.text); Facebook Page "feed" field (item "comment", verb "add", comment_id,
//   post_id, from {id, name}, message).
//   https://developers.facebook.com/docs/graph-api/webhooks/reference/instagram/
//   https://developers.facebook.com/docs/graph-api/webhooks/reference/page/
// - Private replies: POST /{page-id}/messages with recipient {comment_id}; "Only one message can
//   be sent", within 7 days of the comment; Instagram needs instagram_manage_comments and
//   pages_messaging with the Page token, and returns the person's Instagram-scoped id.
//   https://developers.facebook.com/docs/messenger-platform/instagram/features/private-replies
//   https://developers.facebook.com/docs/messenger-platform/discovery/private-replies
// - Public replies: Instagram POST /{comment-id}/replies (instagram_manage_comments, the
//   account's User token); Facebook POST /{comment-id}/comments (pages_manage_engagement, Page token).
//   https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-comment/replies
//   https://developers.facebook.com/docs/graph-api/reference/object/comments/
// - Instagram allows "750 calls per hour per Instagram professional account for private replies
//   to comments on Instagram posts and reels"; CMf caps every account well below that.
//   https://developers.facebook.com/docs/instagram-platform/overview/

export const PER_PERSON_COOLDOWN_MS = 24 * 60 * 60 * 1000; // one auto-reply per person per trigger per day
export const ACCOUNT_HOURLY_LIMIT = 200;
export const PRIVATE_REPLY_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000 - 60 * 60 * 1000; // Meta: 7 days; an hour's margin
export const REPLY_TEXT_MAX_BYTES = 700; // leaves room for the landing link inside Instagram's 1,000 bytes
const WEB_BASE_URL = (process.env["WEB_BASE_URL"] || "https://craftmyfunnel.live").replace(/\/$/, "");
const COMMENT_LEAD_SOURCE: Record<AccountPlatform, string> = { INSTAGRAM: "instagram_comment", FACEBOOK_PAGE: "facebook_comment" };
const TICK_BUDGET_MS = 20_000;
const ROWS_PER_TICK = 20;

// Permissions each kind of send needs (names from the docs above).
export const PRIVATE_SCOPES: Record<"COMMENT" | "DM", Record<AccountPlatform, string[]>> = {
    COMMENT: { INSTAGRAM: ["instagram_manage_comments", "pages_messaging"], FACEBOOK_PAGE: ["pages_messaging"] },
    DM: { INSTAGRAM: ["instagram_manage_messages"], FACEBOOK_PAGE: ["pages_messaging"] },
};
export const PUBLIC_REPLY_SCOPE: Record<AccountPlatform, string> = { INSTAGRAM: "instagram_manage_comments", FACEBOOK_PAGE: "pages_manage_engagement" };

// ---- Matching -------------------------------------------------------------------------------

/** Lower-cased words (letters and digits, any script), so "GUIDE!!" and "guide pls" both have "guide". */
export function words(text: string) {
    return text.normalize("NFKC").toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

/** EXACT: the whole message is the keyword. CONTAINS: the keyword's words appear together in it. */
export function matchesKeyword(text: string, keywords: string[], match: "EXACT" | "CONTAINS") {
    const message = words(text);
    return keywords.some((keyword) => {
        const k = words(keyword);
        if (k.length === 0 || k.length > message.length) return false;
        if (match === "EXACT") return k.length === message.length && k.every((w, i) => w === message[i]);
        for (let start = 0; start + k.length <= message.length; start++) {
            if (k.every((w, i) => w === message[start + i])) return true;
        }
        return false;
    });
}

/** Facebook post ids come as "<page>_<post>" in some places and bare in others. */
function samePostId(a: string, b: string) {
    const tail = (id: string) => id.split("_").pop() as string;
    return a === b || tail(a) === tail(b);
}

// ---- Webhook side: read comments, queue replies -------------------------------------------------

export type CommentEvent = {
    platform: AccountPlatform;
    accountExternalId: string;
    commentId: string;
    authorId: string;
    authorHandle: string | null; // "@username" (Instagram)
    authorName: string | null; // name (Facebook)
    text: string;
    objectId: string | null; // Instagram media id / Facebook post id
};

// New comments only. Comments by the account itself (including CMf's own public replies) are
// skipped, so a reply that repeats the keyword can't trigger itself.
export function extractCommentEvents(body: any): CommentEvent[] {
    const platform = ACCOUNT_PLATFORM_FOR_OBJECT[body?.object];
    if (!platform) return [];
    const events: CommentEvent[] = [];
    for (const entry of Array.isArray(body?.entry) ? body.entry : []) {
        const accountExternalId = String(entry?.id ?? "");
        for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
            const v = change?.value;
            let event: CommentEvent | null = null;
            if (platform === "INSTAGRAM" && change?.field === "comments") {
                const username = plainName(v?.from?.username, 60).replace(/^@/, "");
                event = {
                    platform,
                    accountExternalId,
                    commentId: String(v?.id ?? ""),
                    authorId: String(v?.from?.id ?? ""),
                    authorHandle: username ? `@${username}` : null,
                    authorName: null,
                    text: typeof v?.text === "string" ? v.text : "",
                    objectId: v?.media?.id ? String(v.media.id) : null,
                };
            } else if (platform === "FACEBOOK_PAGE" && change?.field === "feed" && v?.item === "comment" && v?.verb === "add") {
                event = {
                    platform,
                    accountExternalId,
                    commentId: String(v?.comment_id ?? ""),
                    authorId: String(v?.from?.id ?? ""),
                    authorHandle: null,
                    authorName: plainName(v?.from?.name, 100) || null,
                    text: typeof v?.message === "string" ? v.message : "",
                    objectId: v?.post_id ? String(v.post_id) : null,
                };
            }
            if (!event || !accountExternalId || !event.commentId || !event.authorId || !event.text) continue;
            if (event.authorId === accountExternalId) continue;
            events.push(event);
        }
    }
    return events;
}

type MatchKind = "COMMENT" | "DM";

// The account's oldest active trigger that matches. A post restriction applies to comments only.
async function findMatchingTrigger(account: ReceivingAccount, kind: MatchKind, text: string, objectId: string | null) {
    const triggers = await prisma.keywordTrigger.findMany({
        where: { socialAccountId: account.id, teamId: account.teamId, active: true, scope: { in: [kind, "BOTH"] } },
        orderBy: { createdAt: "asc" },
        select: {
            id: true,
            keywords: true,
            match: true,
            contentPostId: true,
            publicCommentReply: true,
            contentPost: { select: { targets: { where: { socialAccountId: account.id }, select: { externalId: true } } } },
        },
    });
    return (
        triggers.find((trigger) => {
            if (!matchesKeyword(text, trigger.keywords, trigger.match)) return false;
            if (kind === "DM" || !trigger.contentPostId) return true;
            const ids = (trigger.contentPost?.targets ?? []).map((t) => t.externalId).filter((id): id is string => Boolean(id));
            return objectId !== null && ids.some((id) => samePostId(id, objectId));
        }) ?? null
    );
}

async function repliedRecently(triggerId: string, personKey: string, now: Date) {
    const recent = await prisma.keywordTriggerReply.count({
        where: { triggerId, personKey, createdAt: { gte: new Date(now.getTime() - PER_PERSON_COOLDOWN_MS) } },
    });
    return recent > 0;
}

const isUniqueViolation = (error: unknown) => (error as any)?.code === "P2002";

async function claim(data: {
    teamId: string;
    triggerId: string;
    socialAccountId: string;
    sourceKey: string;
    personKey: string;
    personHandle?: string | null;
    commentId?: string | null;
    leadId?: string | null;
    publicStatus?: string | null;
}) {
    try {
        await prisma.keywordTriggerReply.create({ data });
        return true;
    } catch (error) {
        if (isUniqueViolation(error)) return false; // already queued (Meta retried the delivery)
        throw error;
    }
}

export async function queueCommentReplies(event: CommentEvent, accounts: ReceivingAccount[], now = new Date()) {
    let queued = 0;
    for (const account of accounts) {
        const trigger = await findMatchingTrigger(account, "COMMENT", event.text, event.objectId);
        if (!trigger || (await repliedRecently(trigger.id, event.authorId, now))) continue;
        const ok = await claim({
            teamId: account.teamId,
            triggerId: trigger.id,
            socialAccountId: account.id,
            sourceKey: `comment:${event.commentId}`,
            personKey: event.authorId,
            personHandle: event.authorHandle ?? event.authorName,
            commentId: event.commentId,
            publicStatus: trigger.publicCommentReply ? "PENDING" : null,
        });
        if (ok) queued++;
    }
    return queued;
}

export async function queueDmReply(account: ReceivingAccount, dm: { mid: string; senderId: string; text: string; leadId: string }, now = new Date()) {
    const trigger = await findMatchingTrigger(account, "DM", dm.text, null);
    if (!trigger || (await repliedRecently(trigger.id, dm.senderId, now))) return false;
    return claim({
        teamId: account.teamId,
        triggerId: trigger.id,
        socialAccountId: account.id,
        sourceKey: `dm:${dm.mid}`,
        personKey: dm.senderId,
        leadId: dm.leadId,
    });
}

// ---- Worker side: send queued replies -----------------------------------------------------------

const REPLY_INCLUDE = {
    trigger: {
        select: {
            id: true,
            teamId: true,
            active: true,
            replyText: true,
            publicCommentReply: true,
            landingPageId: true,
            socialAccount: {
                select: { id: true, teamId: true, platform: true, externalId: true, parentExternalId: true, status: true, scopes: true, encryptedToken: true },
            },
        },
    },
} as const;

type ReplyRow = {
    id: string;
    teamId: string;
    socialAccountId: string;
    sourceKey: string;
    personKey: string;
    personHandle: string | null;
    commentId: string | null;
    leadId: string | null;
    status: string;
    publicStatus: string | null;
    createdAt: Date;
    trigger: {
        id: string;
        teamId: string;
        active: boolean;
        replyText: string;
        publicCommentReply: string | null;
        landingPageId: string | null;
        socialAccount: {
            id: string;
            teamId: string;
            platform: string;
            externalId: string;
            parentExternalId: string | null;
            status: string;
            scopes: string[];
            encryptedToken: unknown;
        };
    };
};

// Conditional on the status we expect, so two workers (or a retry) can never both send.
function setStatus(id: string, from: string, data: Record<string, unknown>) {
    return prisma.keywordTriggerReply.updateMany({ where: { id, status: from }, data });
}
function setPublicStatus(id: string, from: string, data: Record<string, unknown>) {
    return prisma.keywordTriggerReply.updateMany({ where: { id, publicStatus: from }, data });
}

function missingScopes(granted: string[], needed: string[]) {
    return needed.filter((scope) => !granted.includes(scope));
}

async function replyText(row: ReplyRow) {
    const { replyText: text, landingPageId } = row.trigger;
    if (!landingPageId) return text;
    const page = await prisma.landingPage.findFirst({ where: { id: landingPageId, teamId: row.teamId, status: "published" }, select: { slug: true } });
    if (!page) return null;
    return `${text}\n\n${WEB_BASE_URL}/p/${encodeURIComponent(page.slug)}`;
}

function errorText(error: unknown) {
    if (error instanceof GraphError) return error.message;
    return error instanceof Error ? error.message.slice(0, 300) : "Unknown error";
}

async function sendPrivate(row: ReplyRow, now: Date, flagOn: boolean) {
    const account = row.trigger.socialAccount;
    const platform = account.platform as AccountPlatform;
    const kind: MatchKind = row.commentId ? "COMMENT" : "DM";
    const skip = (reason: string) => setStatus(row.id, "PENDING", { status: "SKIPPED", lastError: reason });
    const fail = (reason: string) => setStatus(row.id, "PENDING", { status: "FAILED", lastError: reason });

    if (!row.trigger.active || !flagOn) return skip("The auto-reply was switched off before it was sent.");
    const age = now.getTime() - row.createdAt.getTime();
    if (kind === "COMMENT" && age > PRIVATE_REPLY_MAX_AGE_MS) return skip("Meta only allows a private reply within 7 days of the comment.");
    if (kind === "DM" && age > REPLY_WINDOW_MS) return skip("Meta only allows replies within 24 hours of the person's message.");
    if (account.status !== "CONNECTED") return fail("The account is disconnected. Reconnect it in Settings.");
    const missing = missingScopes(account.scopes, PRIVATE_SCOPES[kind][platform]);
    if (missing.length) return fail(`Reconnect the account and allow: ${missing.join(", ")}.`);
    const token = await pageTokenFor(account);
    if (!token) return fail("The Facebook Page this account uses isn't connected.");
    const text = await replyText(row);
    if (text === null) return fail("The landing page this auto-reply links to isn't published.");

    // At most once: SENDING right before the one call that sends it. A row left in SENDING
    // (crash mid-call) is never sent again.
    const claimed = await setStatus(row.id, "PENDING", { status: "SENDING" });
    if (claimed.count !== 1) return;

    const pageId = encodeURIComponent(platform === "INSTAGRAM" ? (account.parentExternalId as string) : account.externalId);
    const recipient = kind === "COMMENT" ? { comment_id: row.commentId } : { id: row.personKey };
    let result: any;
    try {
        result =
            platform === "INSTAGRAM"
                ? await graphCall(
                      "POST",
                      kind === "COMMENT" ? `${pageId}/messages` : "me/messages",
                      { recipient: JSON.stringify(recipient), message: JSON.stringify({ text }) },
                      token
                  )
                : await graphPostJson(`${pageId}/messages`, { recipient, ...(kind === "DM" ? { messaging_type: "RESPONSE" } : {}), message: { text } }, token);
    } catch (error) {
        const uncertain = error instanceof GraphError && error.uncertain;
        await setStatus(row.id, "SENDING", {
            status: uncertain ? "UNCONFIRMED" : "FAILED",
            lastError: uncertain ? "Meta didn't confirm the auto-reply was sent; it won't be retried." : errorText(error),
        });
        return;
    }

    const messageId = typeof result?.message_id === "string" ? result.message_id : null;
    await setStatus(row.id, "SENDING", { status: "SENT", messageId, lastError: null });
    try {
        await recordSent(row, platform, text, messageId, typeof result?.recipient_id === "string" ? result.recipient_id : null);
    } catch (error) {
        console.error("[KeywordTriggers] Recording a sent auto-reply failed:", errorText(error));
    }
}

// The reply on the lead's thread. A commenter becomes a lead here, keyed by the id Meta returns
// for them, so their later DMs land on the same lead.
async function recordSent(row: ReplyRow, platform: AccountPlatform, text: string, messageId: string | null, recipientId: string | null) {
    const account: ReceivingAccount = { id: row.socialAccountId, teamId: row.teamId, platform };
    let leadId = row.leadId;
    if (!leadId && recipientId) {
        const { contact, isNew } = await findOrCreateContact(account, recipientId, {
            source: COMMENT_LEAD_SOURCE[platform],
            handle: platform === "INSTAGRAM" ? row.personHandle : null,
            name: platform === "FACEBOOK_PAGE" ? row.personHandle : null,
        });
        leadId = contact.leadId;
        await prisma.keywordTriggerReply.update({ where: { id: row.id }, data: { leadId } });
        if (isNew) {
            const { applyFunnelEvent } = await import("./funnelStageService");
            await applyFunnelEvent(row.teamId, leadId, "social_first_touch").catch(() => undefined);
        }
    }
    if (!leadId) return;
    await prisma.message.create({
        data: {
            leadId,
            content: text,
            direction: "OUTBOUND",
            platform: MESSAGE_PLATFORM[platform],
            sender: "Auto-reply",
            status: "sent",
            isRead: true,
            externalId: messageId ? `${row.socialAccountId}:${messageId}` : null,
        },
    });
}

async function sendPublic(row: ReplyRow, flagOn: boolean) {
    const account = row.trigger.socialAccount;
    const platform = account.platform as AccountPlatform;
    const message = row.trigger.publicCommentReply;
    if (!row.commentId || !message || !row.trigger.active || !flagOn) {
        return setPublicStatus(row.id, "PENDING", { publicStatus: "SKIPPED" });
    }
    const failPublic = (reason: string) => setPublicStatus(row.id, "PENDING", { publicStatus: "FAILED", lastError: `Public reply: ${reason}` });
    if (account.status !== "CONNECTED") return failPublic("the account is disconnected.");
    if (!account.scopes.includes(PUBLIC_REPLY_SCOPE[platform])) return failPublic(`reconnect and allow ${PUBLIC_REPLY_SCOPE[platform]}.`);
    // Instagram comment replies use the account's own User token; Facebook uses the Page token.
    const token =
        platform === "INSTAGRAM"
            ? ((await decryptCredential(account.encryptedToken as EncryptedCredential).catch(() => undefined)) ?? null)
            : await pageTokenFor(account);
    if (!token) return failPublic("the account's token is missing. Reconnect it.");

    const claimed = await setPublicStatus(row.id, "PENDING", { publicStatus: "SENDING" });
    if (claimed.count !== 1) return;
    const commentId = encodeURIComponent(row.commentId);
    try {
        await graphCall("POST", platform === "INSTAGRAM" ? `${commentId}/replies` : `${commentId}/comments`, { message }, token);
        await setPublicStatus(row.id, "SENDING", { publicStatus: "SENT" });
    } catch (error) {
        const uncertain = error instanceof GraphError && error.uncertain;
        await setPublicStatus(row.id, "SENDING", {
            publicStatus: uncertain ? "UNCONFIRMED" : "FAILED",
            lastError: `Public reply: ${uncertain ? "Meta didn't confirm it was posted; it won't be retried." : errorText(error)}`,
        });
    }
}

/** One worker tick: sends queued auto-replies, oldest first, within each account's hourly cap. */
export async function sendPendingAutoReplies(now = new Date()) {
    const started = Date.now();
    const rows = (await prisma.keywordTriggerReply.findMany({
        where: { OR: [{ status: "PENDING" }, { publicStatus: "PENDING" }] },
        orderBy: { createdAt: "asc" },
        take: ROWS_PER_TICK,
        include: REPLY_INCLUDE,
    })) as unknown as ReplyRow[];

    const { isCreatorFunnelEnabled } = await import("./featureGate");
    const flags = new Map<string, boolean>();
    const sentThisHour = new Map<string, number>();
    let handled = 0;

    for (const row of rows) {
        if (Date.now() - started > TICK_BUDGET_MS) break;
        try {
            if (!flags.has(row.teamId)) flags.set(row.teamId, await isCreatorFunnelEnabled(row.teamId));
            const flagOn = flags.get(row.teamId) as boolean;

            if (!sentThisHour.has(row.socialAccountId)) {
                sentThisHour.set(
                    row.socialAccountId,
                    await prisma.keywordTriggerReply.count({
                        where: {
                            socialAccountId: row.socialAccountId,
                            status: { in: ["SENDING", "SENT", "UNCONFIRMED"] },
                            updatedAt: { gte: new Date(now.getTime() - 60 * 60 * 1000) },
                        },
                    })
                );
            }
            if ((sentThisHour.get(row.socialAccountId) as number) >= ACCOUNT_HOURLY_LIMIT) continue; // stays queued

            if (row.status === "PENDING") {
                await sendPrivate(row, now, flagOn);
                sentThisHour.set(row.socialAccountId, (sentThisHour.get(row.socialAccountId) as number) + 1);
            }
            if (row.publicStatus === "PENDING") await sendPublic(row, flagOn);
            handled++;
        } catch (error) {
            console.error(`[KeywordTriggers] Auto-reply ${row.id} failed:`, errorText(error));
        }
    }
    return { handled };
}
