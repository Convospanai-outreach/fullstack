import crypto from "crypto";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rateLimit";
import { captureException } from "@/lib/sentry";

const TRACKING_TOKEN_PATTERN = /^[A-Za-z0-9._~-]{8,200}$/;
const EVENT_BUCKET_MS = 60 * 60 * 1000;

type TrackingMetadata = {
    userAgent?: string;
    referrer?: string;
    ipHash: string;
    bot: boolean;
};

type EmailRecord = {
    id: string;
    leadId: string | null;
    campaignId: string | null;
    mailboxId: string | null;
    lead?: { email: string | null } | null;
    campaign: { teamId: string | null } | null;
};

type TrackedLinkRecord = {
    id: string;
    teamId: string;
    emailId: string | null;
    mailboxId: string | null;
    leadId: string | null;
    campaignId: string | null;
    destinationUrl: string;
    status: string;
    firstClickedAt: Date | null;
    expiresAt: Date | null;
    email: EmailRecord | null;
};

function hasValidTokenShape(token: string) {
    return TRACKING_TOKEN_PATTERN.test(token);
}

function getMetadataSecret() {
    const secret = process.env["NEXTAUTH_SECRET"] || process.env["AUTH_SECRET"] || process.env["ENCRYPTION_KEY"];
    if (!secret) {
        throw new Error("NEXTAUTH_SECRET, AUTH_SECRET or ENCRYPTION_KEY must be set to hash tracking metadata");
    }
    return secret;
}

function sanitizeHeader(value: string | null, maxLength: number) {
    if (!value) return undefined;
    const clean = value.replace(/[\r\n]/g, " ").trim();
    return clean ? clean.slice(0, maxLength) : undefined;
}

function sanitizeReferrer(value: string | null) {
    if (!value) return undefined;
    try {
        const parsed = new URL(value);
        if (!["http:", "https:"].includes(parsed.protocol)) return undefined;
        return `${parsed.origin}${parsed.pathname}`.slice(0, 500);
    } catch {
        return undefined;
    }
}

function isLikelyBot(userAgent?: string) {
    if (!userAgent) return false;
    return /\b(bot|crawler|spider|preview|scanner|security|antivirus|linkexpander|urlscan|httpclient|curl|wget)\b/i.test(userAgent);
}

function firstForwardedIp(headers: Headers) {
    return sanitizeHeader(headers.get("x-forwarded-for")?.split(",")[0] || headers.get("x-real-ip"), 128) || "unknown";
}

function hashIp(ip: string) {
    return crypto.createHmac("sha256", getMetadataSecret()).update(ip).digest("base64url");
}

function requestMetadata(headers: Headers): TrackingMetadata {
    const userAgent = sanitizeHeader(headers.get("user-agent"), 300);
    return {
        userAgent,
        referrer: sanitizeReferrer(headers.get("referer")),
        ipHash: hashIp(firstForwardedIp(headers)),
        bot: isLikelyBot(userAgent),
    };
}

function eventFingerprint(metadata: TrackingMetadata) {
    return crypto
        .createHash("sha256")
        .update(`${metadata.ipHash}:${metadata.userAgent || ""}:${metadata.bot ? "bot" : "user"}`)
        .digest("base64url")
        .slice(0, 32);
}

function eventBucket(now: Date) {
    return Math.floor(now.getTime() / EVENT_BUCKET_MS);
}

function safeDestinationUrl(value: string) {
    try {
        const parsed = new URL(value);
        if (!["http:", "https:"].includes(parsed.protocol)) return null;
        parsed.username = "";
        parsed.password = "";
        return parsed;
    } catch {
        return null;
    }
}

function emailSelect(includeLead = false) {
    return {
        id: true,
        leadId: true,
        campaignId: true,
        mailboxId: true,
        ...(includeLead ? { lead: { select: { email: true } } } : {}),
        campaign: { select: { teamId: true } },
    };
}

async function createAggregateEvent(input: {
    teamId: string;
    emailId?: string | null;
    mailboxId?: string | null;
    leadId?: string | null;
    campaignId?: string | null;
    type: "OPEN" | "CLICK";
    provider: string;
    providerMessageId: string;
    payload?: Record<string, unknown>;
}) {
    try {
        await (prisma as any).emailEvent.create({
            data: {
                teamId: input.teamId,
                emailId: input.emailId,
                mailboxId: input.mailboxId,
                leadId: input.leadId,
                campaignId: input.campaignId,
                type: input.type,
                provider: input.provider,
                providerMessageId: input.providerMessageId,
                ...(input.payload ? { payload: input.payload } : {}),
            },
        });
    } catch (error: any) {
        if (error?.code !== "P2002") {
            throw error;
        }
    }
}

async function resolveTrackedLink(token: string): Promise<TrackedLinkRecord | null> {
    if (!hasValidTokenShape(token)) return null;
    const trackedLinkModel = (prisma as any).trackedLink;
    if (!trackedLinkModel) {
        throw new Error("TrackedLink Prisma model is required for click tracking.");
    }

    const matches = await trackedLinkModel.findMany({
        where: { trackingKey: token },
        take: 2,
        select: {
            id: true,
            teamId: true,
            emailId: true,
            mailboxId: true,
            leadId: true,
            campaignId: true,
            destinationUrl: true,
            status: true,
            firstClickedAt: true,
            expiresAt: true,
            email: { select: emailSelect(false) },
        },
    });
    if (matches.length !== 1) return null;
    return matches[0];
}

async function resolveEmailByTrackingToken(token: string, includeLead = false): Promise<EmailRecord | null> {
    if (!hasValidTokenShape(token)) return null;
    return (prisma as any).email.findUnique({
        where: { trackingId: token },
        select: emailSelect(includeLead),
    });
}

export async function recordEmailOpen(input: { token: string; headers: Headers }) {
    const email = await resolveEmailByTrackingToken(input.token);
    const teamId = email?.campaign?.teamId;
    if (!email || !teamId) return { recorded: false };

    const metadata = requestMetadata(input.headers);
    const rateLimit = await checkRateLimit(
        `${input.token}:${metadata.ipHash}`,
        { windowMs: 60_000, maxRequests: 30 },
        "email-open-tracking"
    );
    if (!rateLimit.allowed) return { recorded: false, rateLimited: true };

    const now = new Date();
    await (prisma as any).email.updateMany({
        where: { id: email.id, openedAt: null },
        data: { openedAt: now },
    });
    await createAggregateEvent({
        teamId,
        emailId: email.id,
        mailboxId: email.mailboxId,
        leadId: email.leadId,
        campaignId: email.campaignId,
        type: "OPEN",
        provider: "TRACKING_PIXEL",
        providerMessageId: `open:${email.id}:${eventFingerprint(metadata)}:${eventBucket(now)}`,
        payload: metadata,
    });

    return { recorded: true };
}

export async function recordEmailClick(input: { token: string; headers: Headers }) {
    const link = await resolveTrackedLink(input.token);
    if (!link || link.status !== "ACTIVE") return { allowed: false as const };
    if (link.expiresAt && link.expiresAt <= new Date()) return { allowed: false as const };

    const destination = safeDestinationUrl(link.destinationUrl);
    if (!destination) return { allowed: false as const };

    const metadata = requestMetadata(input.headers);
    const rateLimit = await checkRateLimit(
        `${input.token}:${metadata.ipHash}`,
        { windowMs: 60_000, maxRequests: 30 },
        "email-click-tracking"
    );
    if (!rateLimit.allowed) {
        return { allowed: true as const, destinationUrl: destination.toString(), rateLimited: true };
    }

    const now = new Date();
    const email = link.email;
    const teamId = link.teamId || email?.campaign?.teamId;
    if (!teamId) return { allowed: false as const };

    await (prisma as any).trackedLink.update({
        where: { id: link.id },
        data: {
            clickCount: { increment: 1 },
            lastClickedAt: now,
            ...(link.firstClickedAt ? {} : { firstClickedAt: now }),
        },
    });
    if (email?.id) {
        await (prisma as any).email.updateMany({
            where: { id: email.id, clickedAt: null },
            data: { clickedAt: now },
        });
    }

    await createAggregateEvent({
        teamId,
        emailId: link.emailId,
        mailboxId: link.mailboxId,
        leadId: link.leadId,
        campaignId: link.campaignId,
        type: "CLICK",
        provider: "TRACKING_REDIRECT",
        providerMessageId: `click:${link.id}:${eventFingerprint(metadata)}:${eventBucket(now)}`,
        payload: {
            ...metadata,
            linkId: link.id,
            destinationHost: destination.hostname,
        },
    });

    return { allowed: true as const, destinationUrl: destination.toString() };
}

export async function registerStandaloneUnsubscribe(input: { teamId: string; leadId?: string; token: string; recipient: string }) {
    await prisma.emailEvent.create({
        data: {
            teamId: input.teamId, leadId: input.leadId ?? null, type: "UNSUBSCRIBE_TOKEN",
            provider: "UNSUBSCRIBE_LINK", providerMessageId: input.token,
            payload: { recipient: input.recipient.trim().toLowerCase() },
        },
    });
}

export async function recordEmailUnsubscribe(token: string) {
    if (!hasValidTokenShape(token)) return;
    // Keyed on the token alone: web-forwarded requests all arrive from the web server, so an IP key would not separate callers.
    const rateLimit = await checkRateLimit(token, { windowMs: 60_000, maxRequests: 10 }, "email-unsubscribe-tracking");
    if (!rateLimit.allowed) return;
    const select = {
        id: true, leadId: true, campaignId: true, mailboxId: true,
        campaign: { select: { teamId: true } }, lead: { select: { email: true, teamId: true } },
    } as const;
    const email = await prisma.email.findUnique({ where: { trackingId: token }, select })
        ?? await prisma.email.findUnique({ where: { id: token }, select });
    const standalone = email ? null : await prisma.emailEvent.findFirst({
        where: { provider: "UNSUBSCRIBE_LINK", providerMessageId: token, type: "UNSUBSCRIBE_TOKEN" },
        select: { teamId: true, leadId: true, payload: true },
    });
    const teamId = email?.campaign.teamId ?? standalone?.teamId;
    const initialRecipient = standalone?.payload && typeof standalone.payload === "object" && !Array.isArray(standalone.payload)
        ? standalone.payload["recipient"] : null;
    const recipientEmail = email?.lead.email?.trim().toLowerCase() ?? (typeof initialRecipient === "string" ? initialRecipient : null);
    if (!teamId || (email && email.lead.teamId !== teamId) || !recipientEmail) return;

    const { SequenceService } = await import("./sequenceService");
    const now = new Date();
    let unsubscribedLeadIds: string[] = [];
    await prisma.$transaction(async (tx) => {
        if (email) await tx.email.updateMany({
            where: { id: email.id, unsubscribedAt: null },
            data: { unsubscribedAt: now, status: "unsubscribed" },
        });
        const leadId = email?.leadId ?? standalone?.leadId ?? null;
        await tx.suppressionEntry.upsert({
            where: { teamId_email: { teamId, email: recipientEmail } },
            create: { teamId, email: recipientEmail, reason: "UNSUBSCRIBE", source: "RFC8058_ONE_CLICK", leadId },
            update: { reason: "UNSUBSCRIBE", source: "RFC8058_ONE_CLICK" },
        });
        const scopedLeads = leadId ? [leadId] : (await tx.lead.findMany({
            where: { teamId, email: { equals: recipientEmail, mode: "insensitive" } }, select: { id: true },
        })).map((lead) => lead.id);
        await tx.lead.updateMany({
            where: { id: { in: scopedLeads }, teamId, status: { not: "OPT_OUT" } },
            data: { status: "OPT_OUT" },
        });
        unsubscribedLeadIds = scopedLeads;
        for (const id of scopedLeads) await SequenceService.stopEnrollmentsForLead(teamId, id, "EXIT_UNSUBSCRIBED", now, tx);

        const replies = await tx.message.findMany({
            where: { leadId: { in: scopedLeads }, platform: "EMAIL", direction: "INBOUND" },
            select: { id: true },
        });
        const replyIdByKey = new Map(replies.map(({ id }) => ["scheduled_inbox_reply:" + teamId + ":" + id, id]));
        const waiting = await tx.job.findMany({
            where: { teamId, type: "scheduled_inbox_reply", idempotencyKey: { in: [...replyIdByKey.keys()] }, status: { in: ["queued", "pending"] } },
            select: { id: true, idempotencyKey: true },
        });
        for (const job of waiting) {
            const id = replyIdByKey.get(job.idempotencyKey ?? "");
            if (!id) continue;
            await tx.job.updateMany({
                where: { id: job.id, status: { in: ["queued", "pending"] } },
                data: { status: "cancelled", completedAt: now, idempotencyKey: null, payload: {}, result: { cancelledReplyId: id } },
            });
        }

        const event = {
            teamId, emailId: email?.id ?? null, mailboxId: email?.mailboxId ?? null, leadId, campaignId: email?.campaignId ?? null,
            type: "UNSUBSCRIBED", provider: "UNSUBSCRIBE_LINK", providerMessageId: "unsubscribe:" + (email?.id ?? token),
        };
        await tx.emailEvent.createMany({ data: [event], skipDuplicates: true });
    });
    const { onLeadHumanAction } = await import("@/modules/inbox/replySubsequenceService");
    // Best-effort: the opt-out is already recorded and the follow-up worker re-checks suppression before every step,
    // so a failure to cancel the plan is reported instead of failing this request.
    for (const leadId of unsubscribedLeadIds) {
        try { await onLeadHumanAction(teamId, leadId, null, "unsubscribe"); } catch (error) { captureException(error); }
    }
}
