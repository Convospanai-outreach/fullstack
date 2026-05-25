import crypto from "crypto";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rateLimit";

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
    return process.env["NEXTAUTH_SECRET"] || process.env["AUTH_SECRET"] || process.env["ENCRYPTION_KEY"] || "tracking-metadata";
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
    type: "OPEN" | "CLICK" | "UNSUBSCRIBE";
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

export async function recordEmailUnsubscribe(input: { token: string; headers: Headers }) {
    const email = await resolveEmailByTrackingToken(input.token, true);
    const teamId = email?.campaign?.teamId;
    const recipientEmail = email?.lead?.email?.trim().toLowerCase();
    if (!email || !teamId || !recipientEmail) return { recorded: false };

    const metadata = requestMetadata(input.headers);
    const rateLimit = await checkRateLimit(
        `${input.token}:${metadata.ipHash}`,
        { windowMs: 60_000, maxRequests: 10 },
        "email-unsubscribe-tracking"
    );
    if (!rateLimit.allowed) return { recorded: false, rateLimited: true };

    await (prisma as any).email.updateMany({
        where: { id: email.id },
        data: { unsubscribedAt: new Date(), status: "unsubscribed" },
    });
    await (prisma as any).suppressionEntry.upsert({
        where: { teamId_email: { teamId, email: recipientEmail } },
        create: {
            teamId,
            email: recipientEmail,
            reason: "UNSUBSCRIBE",
            source: "LINK",
            leadId: email.leadId,
        },
        update: {
            reason: "UNSUBSCRIBE",
            source: "LINK",
            leadId: email.leadId,
        },
    });
    await createAggregateEvent({
        teamId,
        emailId: email.id,
        mailboxId: email.mailboxId,
        leadId: email.leadId,
        campaignId: email.campaignId,
        type: "UNSUBSCRIBE",
        provider: "UNSUBSCRIBE_LINK",
        providerMessageId: `unsubscribe:${email.id}`,
        payload: metadata,
    });

    return { recorded: true };
}
