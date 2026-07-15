import { prisma } from "@/lib/db";
import crypto from "crypto";

const db = prisma as any;

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_PROFILE_URL = "https://gmail.googleapis.com/gmail/v1/users/me/profile";
const GMAIL_MESSAGES_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages";
const GMAIL_THREADS_URL = "https://gmail.googleapis.com/gmail/v1/users/me/threads";
const GMAIL_HISTORY_URL = "https://gmail.googleapis.com/gmail/v1/users/me/history";
const GMAIL_WATCH_URL = "https://gmail.googleapis.com/gmail/v1/users/me/watch";

const GOOGLE_MAIL_SCOPES = [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.readonly",
];

type EncryptedSecret = {
    v: number;
    cipher: string;
    iv: string;
    tag: string;
};

type OAuthStatePayload = {
    teamId: string;
    userId: string;
    nextPath?: string;
    nonce: string;
    ts: number;
};

type GmailSyncResult = {
    synced: number;
    replies: number;
    bounces: number;
};

type GooglePubSubMessage = {
    messageId?: string;
    data?: string;
    attributes?: Record<string, string>;
};

function getEncryptionKey(): Buffer {
    const key = process.env["ENCRYPTION_KEY"];
    if (typeof key !== "string") {
        throw new Error("ENCRYPTION_KEY must be a string.");
    }
    if (key.length !== 64) {
        throw new Error("ENCRYPTION_KEY must be exactly 64 characters.");
    }
    const hexRegex = /^[0-9a-fA-F]{64}$/;
    if (!hexRegex.test(key)) {
        throw new Error("ENCRYPTION_KEY must contain hexadecimal characters only.");
    }
    const keyBuffer = Buffer.from(key, "hex");
    if (keyBuffer.length !== 32) {
        throw new Error("ENCRYPTION_KEY must decode to exactly 32 bytes.");
    }
    return keyBuffer;
}

function getStateSecret(): string {
    return process.env["NEXTAUTH_SECRET"] || process.env["AUTH_SECRET"] || process.env["ENCRYPTION_KEY"] || "";
}

function getGoogleConfig() {
    const clientId = process.env["GOOGLE_CLIENT_ID"];
    const clientSecret = process.env["GOOGLE_CLIENT_SECRET"];
    const redirectUri = process.env["GOOGLE_GMAIL_REDIRECT_URI"] || process.env["GOOGLE_OAUTH_REDIRECT_URI"];
    if (!clientId || !clientSecret || !redirectUri) {
        throw new Error("GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_GMAIL_REDIRECT_URI must be configured.");
    }
    return { clientId, clientSecret, redirectUri };
}

async function encryptSecret(value: string): Promise<EncryptedSecret> {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
        v: 1,
        cipher: encrypted.toString("base64"),
        iv: iv.toString("base64"),
        tag: tag.toString("base64"),
    };
}

export async function decryptMailboxSecret(secret?: EncryptedSecret | null): Promise<string | undefined> {
    if (!secret) return undefined;
    if (secret.v !== 1) return undefined;
    const key = getEncryptionKey();
    const iv = Buffer.from(secret.iv, "base64");
    const tag = Buffer.from(secret.tag, "base64");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([
        decipher.update(Buffer.from(secret.cipher, "base64")),
        decipher.final(),
    ]);
    return decrypted.toString("utf8");
}

function signState(payload: OAuthStatePayload): string {
    const secret = getStateSecret();
    if (!secret) throw new Error("NEXTAUTH_SECRET or ENCRYPTION_KEY is required for Google OAuth state signing.");
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
    return `${body}.${sig}`;
}

function verifyState(state: string): OAuthStatePayload {
    const secret = getStateSecret();
    if (!secret) throw new Error("NEXTAUTH_SECRET or ENCRYPTION_KEY is required for Google OAuth state verification.");
    const [body, sig] = state.split(".");
    if (!body || !sig) throw new Error("Invalid OAuth state.");
    const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expected);
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
        throw new Error("Invalid OAuth state signature.");
    }
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as OAuthStatePayload;
    if (!payload || typeof payload !== "object") {
        throw new Error("Invalid OAuth state structure.");
    }
    if (!payload.teamId || !payload.userId || !payload.nonce || typeof payload.ts !== "number") {
        throw new Error("Invalid OAuth state structure.");
    }
    if (Date.now() - payload.ts > 10 * 60 * 1000) {
        throw new Error("OAuth state expired.");
    }
    return payload;
}

export function sanitizeRelativePath(path?: string | null) {
    if (!path || !path.startsWith("/") || path.startsWith("//")) return "/setup?step=3";
    try {
        const parsed = new URL(path, "https://app.local");
        if (parsed.origin !== "https://app.local") return "/setup?step=3";
        return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
        return "/setup?step=3";
    }
}

export async function buildGoogleMailboxAuthUrl(input: { teamId: string; userId: string; nextPath?: string }): Promise<string> {
    const { clientId, redirectUri } = getGoogleConfig();
    const nonce = crypto.randomUUID();
    const ts = Date.now();
    const statePayload = {
        teamId: input.teamId,
        userId: input.userId,
        nextPath: sanitizeRelativePath(input.nextPath),
        nonce,
        ts,
    };
    const state = signState(statePayload);

    const nonceHash = crypto.createHash("sha256").update(nonce).digest("hex");
    const identifier = `gmail-oauth-state:${input.teamId}:${input.userId}`;
    const expires = new Date(ts + 10 * 60 * 1000);

    try {
        await db.verificationToken.create({
            data: {
                identifier,
                token: nonceHash,
                expires,
            },
        });
    } catch (error) {
        throw new Error("Failed to persist OAuth state.");
    }

    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        access_type: "offline",
        prompt: "consent",
        include_granted_scopes: "true",
        scope: GOOGLE_MAIL_SCOPES.join(" "),
        state,
    });
    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

async function exchangeCodeForTokens(code: string) {
    const { clientId, clientSecret, redirectUri } = getGoogleConfig();
    const response = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: "authorization_code",
        }),
    });
    const data = await response.json() as any;
    if (!response.ok) {
        throw new Error(data?.error_description || data?.error || "Google token exchange failed.");
    }
    return data as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
        scope?: string;
        token_type?: string;
        id_token?: string;
    };
}

async function getGmailProfile(accessToken: string): Promise<{ emailAddress: string; messagesTotal?: number; threadsTotal?: number; historyId?: string }> {
    const response = await fetch(GMAIL_PROFILE_URL, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await response.json() as any;
    if (!response.ok) {
        throw new Error(data?.error?.message || "Unable to read Gmail profile.");
    }
    return data;
}

export async function connectGoogleMailbox(input: { code: string; state: string }) {
    const statePayload = verifyState(input.state);

    const identifier = `gmail-oauth-state:${statePayload.teamId}:${statePayload.userId}`;
    const nonceHash = crypto.createHash("sha256").update(statePayload.nonce).digest("hex");

    const deleteResult = await db.verificationToken.deleteMany({
        where: {
            identifier,
            token: nonceHash,
            expires: {
                gt: new Date(),
            },
        },
    });

    if (deleteResult.count !== 1) {
        throw new Error("Invalid state, expired state, or state already consumed.");
    }

    const token = await exchangeCodeForTokens(input.code);
    const profile = await getGmailProfile(token.access_token);
    const normalizedEmail = normalizeEmailAddress(profile.emailAddress);
    const scopes = token.scope ? token.scope.split(/\s+/).filter(Boolean) : GOOGLE_MAIL_SCOPES;
    const encryptedAccessToken = await encryptSecret(token.access_token);
    const encryptedRefreshToken = token.refresh_token ? await encryptSecret(token.refresh_token) : undefined;
    const tokenExpiresAt = token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null;

    const existingMailbox = await prisma.connectedMailbox.findUnique({
        where: {
            teamId_email: {
                teamId: statePayload.teamId,
                email: normalizedEmail,
            },
        },
    });

    let finalEncryptedRefreshToken = encryptedRefreshToken;
    if (!finalEncryptedRefreshToken && existingMailbox?.encryptedRefreshToken) {
        finalEncryptedRefreshToken = existingMailbox.encryptedRefreshToken as any;
    }

    const hasRefreshToken = !!finalEncryptedRefreshToken;
    const status = hasRefreshToken ? "CONNECTED" : "NEEDS_RECONNECT";

    const mailbox = await prisma.connectedMailbox.upsert({
        where: {
            teamId_email: {
                teamId: statePayload.teamId,
                email: normalizedEmail,
            },
        },
        create: {
            teamId: statePayload.teamId,
            assignedUserId: statePayload.userId,
            provider: "GOOGLE_WORKSPACE",
            authType: "OAUTH",
            email: normalizedEmail,
            status,
            scopes,
            encryptedAccessToken,
            ...(finalEncryptedRefreshToken ? { encryptedRefreshToken: finalEncryptedRefreshToken } : {}),
            tokenExpiresAt,
            historyId: profile.historyId,
            metadata: {
                messagesTotal: profile.messagesTotal,
                threadsTotal: profile.threadsTotal,
                connectedBy: statePayload.userId,
            },
        },
        update: {
            assignedUserId: statePayload.userId,
            authType: "OAUTH",
            status,
            scopes,
            encryptedAccessToken,
            ...(finalEncryptedRefreshToken ? { encryptedRefreshToken: finalEncryptedRefreshToken } : {}),
            tokenExpiresAt,
            historyId: profile.historyId,
            metadata: {
                messagesTotal: profile.messagesTotal,
                threadsTotal: profile.threadsTotal,
                reconnectedBy: statePayload.userId,
            },
        },
    });

    if (process.env["GOOGLE_PUBSUB_TOPIC_NAME"] && finalEncryptedRefreshToken) {
        await registerGoogleMailboxWatch(statePayload.teamId, mailbox.id).catch(async (error: any) => {
            await prisma.connectedMailbox.update({
                where: { id: mailbox.id },
                data: {
                    metadata: mergeMailboxMetadata(mailbox, {
                        lastWatchError: error?.message || "Unable to register Gmail watch.",
                        lastWatchErrorAt: new Date().toISOString(),
                    }),
                },
            }).catch(() => undefined);
        });
    }

    return { mailbox, nextPath: statePayload.nextPath || "/setup?step=3" };
}

export async function listConnectedMailboxes(teamId: string) {
    return prisma.connectedMailbox.findMany({
        where: { teamId },
        select: {
            id: true,
            email: true,
            displayName: true,
            provider: true,
            authType: true,
            status: true,
            assignedUserId: true,
            dailyLimit: true,
            sentToday: true,
            minDelaySeconds: true,
            lastSentAt: true,
            isWarmingUp: true,
            warmupDay: true,
            warmupTargetDays: true,
            bounceCount: true,
            replyCount: true,
            openCount: true,
            clickCount: true,
            lastSyncAt: true,
            createdAt: true,
        },
        orderBy: { createdAt: "desc" },
    });
}

export async function updateMailboxControls(teamId: string, mailboxId: string, data: {
    assignedUserId?: string | null;
    displayName?: string | null;
    dailyLimit?: number;
    minDelaySeconds?: number;
    isWarmingUp?: boolean;
    warmupDay?: number;
    status?: string;
}) {
    if (data.assignedUserId) {
        const member = await prisma.teamMember.findFirst({
            where: { teamId, userId: data.assignedUserId },
            select: { id: true },
        });
        if (!member) {
            throw new Error("Assigned user must belong to this team.");
        }
    }
    const updated = await prisma.connectedMailbox.updateMany({
        where: { id: mailboxId, teamId },
        data,
    });
    if (updated.count === 0) {
        throw new Error("Mailbox not found.");
    }
    return prisma.connectedMailbox.findFirst({
        where: { id: mailboxId, teamId },
        select: {
            id: true,
            email: true,
            displayName: true,
            provider: true,
            authType: true,
            status: true,
            assignedUserId: true,
            dailyLimit: true,
            sentToday: true,
            minDelaySeconds: true,
            lastSentAt: true,
            isWarmingUp: true,
            warmupDay: true,
            warmupTargetDays: true,
            updatedAt: true,
        },
    });
}

export async function assertMailboxCanSend(teamId: string, mailboxId: string) {
    const mailbox = await prisma.connectedMailbox.findFirst({ where: { id: mailboxId, teamId } });
    if (!mailbox || mailbox.status !== "CONNECTED") {
        return { ok: false, reason: "Mailbox is not connected." };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sentTodayDate = mailbox.sentTodayDate ? new Date(mailbox.sentTodayDate) : null;
    const sentToday = sentTodayDate && sentTodayDate >= today ? mailbox.sentToday : 0;
    const warmupLimit = mailbox.isWarmingUp
        ? Math.max(5, Math.min(mailbox.dailyLimit, 5 + mailbox.warmupDay * 5))
        : mailbox.dailyLimit;

    if (sentToday >= warmupLimit) {
        return { ok: false, reason: `Daily send limit reached for ${mailbox.email}.` };
    }

    if (mailbox.lastSentAt) {
        const nextAllowedAt = new Date(mailbox.lastSentAt.getTime() + mailbox.minDelaySeconds * 1000);
        if (nextAllowedAt > new Date()) {
            return { ok: false, reason: `Mailbox throttle active until ${nextAllowedAt.toISOString()}.` };
        }
    }

    return { ok: true, mailbox };
}

export async function markMailboxSend(teamId: string, mailboxId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const mailbox = await prisma.connectedMailbox.findFirst({ where: { id: mailboxId, teamId } });
    if (!mailbox) return null;
    const sentTodayDate = mailbox.sentTodayDate ? new Date(mailbox.sentTodayDate) : null;
    const shouldReset = !sentTodayDate || sentTodayDate < today;
    return prisma.connectedMailbox.update({
        where: { id: mailboxId },
        data: {
            sentTodayDate: today,
            sentToday: shouldReset ? 1 : { increment: 1 },
            lastSentAt: new Date(),
        },
    });
}

export async function selectMailboxForSend(teamId: string, assignedUserId?: string) {
    const queryCandidates = (where: any) => prisma.connectedMailbox.findMany({
        where: {
            teamId,
            status: "CONNECTED",
            ...where,
        },
        orderBy: [
            { sentToday: "asc" },
            { lastSentAt: "asc" },
        ],
        take: 10,
    });

    const candidateGroups = assignedUserId
        ? [await queryCandidates({ assignedUserId }), await queryCandidates({ assignedUserId: null }), await queryCandidates({})]
        : [await queryCandidates({})];

    const seen = new Set<string>();
    for (const candidates of candidateGroups) {
        for (const mailbox of candidates) {
            if (seen.has(mailbox.id)) continue;
            seen.add(mailbox.id);
            const check = await assertMailboxCanSend(teamId, mailbox.id);
            if (check.ok) return mailbox;
        }
    }
    return null;
}

function encodeMimeHeader(value: string) {
    return value.replace(/\r?\n/g, " ").trim();
}

function rejectHeaderInjection(value: string, field: string) {
    if (/[\r\n]/.test(value)) {
        throw new Error(`${field} cannot contain line breaks.`);
    }
}

function normalizeEmailAddress(value: string) {
    rejectHeaderInjection(value, "Email address");
    const match = value.trim().match(/^(?:[^<]*<)?([^<>\s@]+@[^<>\s@]+\.[^<>\s@]+)>?$/);
    if (!match?.[1]) {
        throw new Error("Invalid email address.");
    }
    return match[1].toLowerCase();
}

function base64Url(input: string) {
    return Buffer.from(input)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
}

export async function sendViaGmailMailbox(input: {
    teamId: string;
    mailboxId: string;
    to: string;
    subject: string;
    html: string;
    replyTo?: string;
}) {
    const mailbox = await prisma.connectedMailbox.findFirst({
        where: { id: input.mailboxId, teamId: input.teamId, status: "CONNECTED" },
    });
    if (!mailbox) return { success: false, error: "Connected mailbox not found." };

    const accessToken = await getMailboxAccessToken(mailbox);
    if (!accessToken) return { success: false, error: "Mailbox needs reconnect." };

    const fromName = mailbox.displayName || mailbox.email;
    const to = normalizeEmailAddress(input.to);
    const replyTo = input.replyTo ? normalizeEmailAddress(input.replyTo) : undefined;
    const headers = [
        `From: "${encodeMimeHeader(fromName)}" <${mailbox.email}>`,
        `To: ${to}`,
        `Subject: ${encodeMimeHeader(input.subject)}`,
        "MIME-Version: 1.0",
        "Content-Type: text/html; charset=UTF-8",
        ...(replyTo ? [`Reply-To: ${replyTo}`] : []),
    ];
    const raw = base64Url(`${headers.join("\r\n")}\r\n\r\n${input.html}`);

    const response = await fetch(`${GMAIL_MESSAGES_URL}/send`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw }),
    });
    const data = await response.json() as any;
    if (!response.ok) {
        return { success: false, error: data?.error?.message || "Gmail send failed." };
    }

    await markMailboxSend(input.teamId, mailbox.id);
    return {
        success: true,
        messageId: data.id as string | undefined,
        threadId: data.threadId as string | undefined,
        mailboxId: mailbox.id,
    };
}

export async function recordSuppression(input: {
    teamId: string;
    email: string;
    reason: string;
    source: string;
    leadId?: string;
    createdBy?: string;
}) {
    return prisma.suppressionEntry.upsert({
        where: { teamId_email: { teamId: input.teamId, email: input.email.toLowerCase() } },
        create: {
            teamId: input.teamId,
            email: input.email.toLowerCase(),
            reason: input.reason,
            source: input.source,
            leadId: input.leadId,
            createdBy: input.createdBy,
        },
        update: {
            reason: input.reason,
            source: input.source,
            leadId: input.leadId,
            createdBy: input.createdBy,
        },
    });
}

export async function isSuppressed(teamId: string, email: string) {
    const entry = await prisma.suppressionEntry.findUnique({
        where: { teamId_email: { teamId, email: email.toLowerCase() } },
    });
    return !!entry;
}

export function signTrackedUrl(trackingId: string, targetUrl: string) {
    const secret = getStateSecret();
    if (!secret) throw new Error("NEXTAUTH_SECRET or ENCRYPTION_KEY is required for tracked links.");
    return crypto.createHmac("sha256", secret).update(`${trackingId}:${targetUrl}`).digest("base64url");
}

export function verifyTrackedUrlSignature(trackingId: string, targetUrl: string, signature: string) {
    const expected = signTrackedUrl(trackingId, targetUrl);
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

async function refreshAccessToken(mailbox: any) {
    const refreshToken = await decryptMailboxSecret(mailbox.encryptedRefreshToken);
    if (!refreshToken) throw new Error("Mailbox needs reconnect before sync.");
    const { clientId, clientSecret } = getGoogleConfig();
    const response = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: "refresh_token",
        }),
    });
    const data = await response.json() as any;
    if (!response.ok) {
        await markMailboxNeedsReconnect(mailbox, data?.error_description || data?.error || "Google token refresh failed.");
        throw new Error(data?.error_description || data?.error || "Google token refresh failed.");
    }
    const encryptedAccessToken = await encryptSecret(data.access_token);
    const tokenExpiresAt = data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null;
    await prisma.connectedMailbox.update({
        where: { id: mailbox.id },
        data: { encryptedAccessToken, tokenExpiresAt },
    });
    return data.access_token as string;
}

function mergeMailboxMetadata(mailbox: any, patch: Record<string, unknown>) {
    const current = mailbox?.metadata && typeof mailbox.metadata === "object" && !Array.isArray(mailbox.metadata)
        ? mailbox.metadata
        : {};
    return { ...current, ...patch };
}

async function markMailboxNeedsReconnect(mailbox: any, reason: string) {
    await prisma.connectedMailbox.update({
        where: { id: mailbox.id },
        data: {
            status: "NEEDS_RECONNECT",
            metadata: mergeMailboxMetadata(mailbox, {
                lastSyncError: reason,
                lastSyncErrorAt: new Date().toISOString(),
            }),
        },
    }).catch(() => undefined);
}

async function getMailboxAccessToken(mailbox: any) {
    if (mailbox.encryptedAccessToken && mailbox.tokenExpiresAt && mailbox.tokenExpiresAt > new Date(Date.now() + 60_000)) {
        return decryptMailboxSecret(mailbox.encryptedAccessToken);
    }
    return refreshAccessToken(mailbox);
}

function headerValue(message: any, name: string) {
    const header = message?.payload?.headers?.find((item: any) => item.name?.toLowerCase() === name.toLowerCase());
    return header?.value as string | undefined;
}

function extractEmailAddress(value?: string) {
    if (!value) return "";
    const match = value.match(/<([^>]+)>/);
    return (match?.[1] || value).trim().toLowerCase();
}

function hasReplyCorrelation(message: any) {
    return Boolean(headerValue(message, "In-Reply-To") || headerValue(message, "References") || message.threadId);
}

async function fetchGmailMessage(accessToken: string, id: string) {
    const response = await fetch(`${GMAIL_MESSAGES_URL}/${encodeURIComponent(id)}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=Message-ID&metadataHeaders=In-Reply-To&metadataHeaders=References`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await response.json() as any;
    if (!response.ok) {
        throw new Error(data?.error?.message || "Unable to fetch Gmail message.");
    }
    return data;
}

async function fetchGmailThread(accessToken: string, id: string) {
    const response = await fetch(`${GMAIL_THREADS_URL}/${encodeURIComponent(id)}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=Message-ID&metadataHeaders=In-Reply-To&metadataHeaders=References`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await response.json() as any;
    if (!response.ok) {
        throw new Error(data?.error?.message || "Unable to fetch Gmail thread.");
    }
    return data;
}

async function getOrCreateMailboxCursor(mailbox: any) {
    return db.mailboxSyncCursor.upsert({
        where: { mailboxId_cursorType: { mailboxId: mailbox.id, cursorType: "GMAIL_HISTORY" } },
        create: {
            teamId: mailbox.teamId,
            mailboxId: mailbox.id,
            cursorType: "GMAIL_HISTORY",
            historyId: mailbox.historyId,
            status: "IDLE",
        },
        update: {},
    });
}

async function updateMailboxCursor(mailbox: any, data: {
    historyId?: string | null;
    status?: string;
    lastError?: string | null;
    consecutiveFailures?: number | { increment: number };
}) {
    await db.mailboxSyncCursor.upsert({
        where: { mailboxId_cursorType: { mailboxId: mailbox.id, cursorType: "GMAIL_HISTORY" } },
        create: {
            teamId: mailbox.teamId,
            mailboxId: mailbox.id,
            cursorType: "GMAIL_HISTORY",
            historyId: data.historyId ?? mailbox.historyId,
            status: data.status || "IDLE",
            lastError: data.lastError,
            consecutiveFailures: typeof data.consecutiveFailures === "number" ? data.consecutiveFailures : 0,
            lastSyncedAt: data.status === "IDLE" ? new Date() : undefined,
        },
        update: {
            ...data,
            ...(data.status === "IDLE" ? { lastSyncedAt: new Date(), lockedAt: null, lockExpiresAt: null } : {}),
        },
    });
}

function uniqueValues(values: Array<string | undefined | null>) {
    return [...new Set(values.filter(Boolean) as string[])];
}

async function listKnownOutboundEmails(teamId: string, mailboxId: string) {
    return prisma.email.findMany({
        where: {
            mailboxId,
            campaign: { teamId },
            OR: [
                { threadId: { not: null } },
                { providerId: { not: null } },
            ],
        },
        select: { id: true, leadId: true, campaignId: true, threadId: true, providerId: true },
        orderBy: { createdAt: "desc" },
        take: 500,
    });
}

async function findMatchedOutboundEmail(teamId: string, mailbox: any, message: any) {
    const inReplyTo = headerValue(message, "In-Reply-To");
    const references = headerValue(message, "References") || "";
    const referenceTokens = references.split(/\s+/).map((value) => value.trim()).filter(Boolean);
    const providerIds = uniqueValues([inReplyTo, ...referenceTokens]);
    return prisma.email.findFirst({
        where: {
            mailboxId: mailbox.id,
            campaign: { teamId },
            OR: [
                ...(message.threadId ? [{ threadId: message.threadId }] : []),
                ...providerIds.map((providerId) => ({ providerId })),
            ],
        },
        select: { id: true, leadId: true, campaignId: true },
    });
}

async function createInboundCampaignEvent(input: {
    teamId: string;
    mailbox: any;
    message: any;
}): Promise<"reply" | "bounce" | "ignored" | "duplicate"> {
    const { teamId, mailbox, message } = input;
    if (!hasReplyCorrelation(message)) return "ignored";
    const from = headerValue(message, "From") || "";
    const subject = headerValue(message, "Subject") || "";
    const fromEmail = extractEmailAddress(from);
    if (!fromEmail || fromEmail === mailbox.email.toLowerCase()) return "ignored";

    const matchedEmail = await findMatchedOutboundEmail(teamId, mailbox, message);
    if (!matchedEmail) return "ignored";

    const isBounce = /mailer-daemon|postmaster/i.test(from) || /delivery status notification|undeliver|delivery failed|returned mail/i.test(subject);
    const type = isBounce ? "BOUNCE" : "REPLY";
    const existingEvent = await prisma.emailEvent.findFirst({
        where: {
            teamId,
            provider: "GMAIL_API",
            providerMessageId: message.id,
            type,
        },
        select: { id: true },
    });
    if (existingEvent) return "duplicate";

    try {
        await prisma.emailEvent.create({
            data: {
                teamId,
                emailId: matchedEmail.id,
                mailboxId: mailbox.id,
                leadId: matchedEmail.leadId,
                campaignId: matchedEmail.campaignId,
                type,
                provider: "GMAIL_API",
                providerMessageId: message.id,
                payload: {
                    from,
                    subject,
                    threadId: message.threadId,
                    gmailId: message.id,
                },
            },
        });
    } catch (error: any) {
        if (error?.code === "P2002") return "duplicate";
        throw error;
    }

    await prisma.message.create({
        data: {
            leadId: matchedEmail.leadId,
            content: subject || (isBounce ? "Bounce detected" : "Reply detected"),
            direction: "INBOUND",
            platform: "EMAIL",
            sender: from,
            status: isBounce ? "bounce" : "received",
            isRead: false,
        },
    });

    if (isBounce) {
        await prisma.connectedMailbox.update({
            where: { id: mailbox.id },
            data: { bounceCount: { increment: 1 } },
        });
        await prisma.email.update({
            where: { id: matchedEmail.id },
            data: { bouncedAt: new Date(), status: "bounced" },
        }).catch(() => undefined);
        await prisma.lead.update({
            where: { id: matchedEmail.leadId },
            data: { status: "bounced", updatedAt: new Date() },
        });
        const leadEmail = await prisma.lead.findUnique({
            where: { id: matchedEmail.leadId },
            select: { email: true },
        });
        if (leadEmail?.email) {
            await recordSuppression({
                teamId,
                email: leadEmail.email,
                reason: "BOUNCE",
                source: "GMAIL_SYNC",
                leadId: matchedEmail.leadId,
            });
        }
        return "bounce";
    }

    await prisma.connectedMailbox.update({
        where: { id: mailbox.id },
        data: { replyCount: { increment: 1 } },
    });
    await prisma.email.update({
        where: { id: matchedEmail.id },
        data: { repliedAt: new Date(), status: "replied" },
    }).catch(() => undefined);
    await prisma.lead.update({
        where: { id: matchedEmail.leadId },
        data: { status: "replied", updatedAt: new Date() },
    });
    return "reply";
}

async function processGmailMessages(accessToken: string, teamId: string, mailbox: any, messageIds: string[]): Promise<GmailSyncResult> {
    let replies = 0;
    let bounces = 0;
    let synced = 0;
    for (const messageId of uniqueValues(messageIds)) {
        const message = await fetchGmailMessage(accessToken, messageId);
        const result = await createInboundCampaignEvent({ teamId, mailbox, message });
        if (result === "reply") replies += 1;
        if (result === "bounce") bounces += 1;
        if (result === "reply" || result === "bounce") synced += 1;
    }
    return { synced, replies, bounces };
}

async function syncMailboxByKnownThreads(accessToken: string, teamId: string, mailbox: any): Promise<GmailSyncResult> {
    const knownEmails = await listKnownOutboundEmails(teamId, mailbox.id);
    const threadIds = uniqueValues(knownEmails.map((email) => email.threadId));
    let replies = 0;
    let bounces = 0;
    let synced = 0;
    for (const threadId of threadIds) {
        const thread = await fetchGmailThread(accessToken, threadId);
        for (const message of thread.messages || []) {
            const result = await createInboundCampaignEvent({ teamId, mailbox, message });
            if (result === "reply") replies += 1;
            if (result === "bounce") bounces += 1;
            if (result === "reply" || result === "bounce") synced += 1;
        }
    }
    return { synced, replies, bounces };
}

async function syncMailboxByHistory(accessToken: string, teamId: string, mailbox: any, startHistoryId: string): Promise<GmailSyncResult & { historyId?: string }> {
    let pageToken: string | undefined;
    let historyId: string | undefined;
    const messageIds: string[] = [];
    do {
        const params = new URLSearchParams({
            startHistoryId,
            historyTypes: "messageAdded",
            labelId: "INBOX",
        });
        if (pageToken) params.set("pageToken", pageToken);
        const response = await fetch(`${GMAIL_HISTORY_URL}?${params.toString()}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        const data = await response.json() as any;
        if (!response.ok) {
            const error = new Error(data?.error?.message || "Unable to list Gmail history.") as Error & { status?: number };
            error.status = response.status;
            throw error;
        }
        historyId = data.historyId || historyId;
        for (const record of data.history || []) {
            for (const added of record.messagesAdded || []) {
                if (added?.message?.id) messageIds.push(added.message.id);
            }
        }
        pageToken = data.nextPageToken;
    } while (pageToken);

    return { ...(await processGmailMessages(accessToken, teamId, mailbox, messageIds)), historyId };
}

export async function registerGoogleMailboxWatch(teamId: string, mailboxId: string) {
    const mailbox = await prisma.connectedMailbox.findFirst({ where: { id: mailboxId, teamId } });
    if (!mailbox) throw new Error("Mailbox not found.");
    const accessToken = await getMailboxAccessToken(mailbox);
    if (!accessToken) throw new Error("Mailbox needs reconnect before sync.");

    const topicName = process.env["GOOGLE_PUBSUB_TOPIC_NAME"];
    if (!topicName) throw new Error("GOOGLE_PUBSUB_TOPIC_NAME must be configured for Gmail watch.");
    const response = await fetch(GMAIL_WATCH_URL, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            topicName,
            labelIds: ["INBOX"],
            labelFilterBehavior: "INCLUDE",
        }),
    });
    const data = await response.json() as any;
    if (!response.ok) {
        throw new Error(data?.error?.message || "Unable to register Gmail watch.");
    }
    const historyId = data.historyId || mailbox.historyId;
    const watchExpirationAt = data.expiration ? new Date(Number(data.expiration)) : null;
    const updated = await prisma.connectedMailbox.update({
        where: { id: mailbox.id },
        data: {
            status: "CONNECTED",
            historyId,
            metadata: mergeMailboxMetadata(mailbox, {
                gmailWatchExpirationAt: watchExpirationAt?.toISOString() || null,
                gmailWatchRegisteredAt: new Date().toISOString(),
                lastWatchError: null,
            }),
        },
    });
    await updateMailboxCursor(updated, {
        historyId,
        status: "IDLE",
        lastError: null,
        consecutiveFailures: 0,
    });
    return { mailboxId: mailbox.id, historyId, watchExpirationAt };
}

export async function renewDueGoogleMailboxWatches(limit = 25) {
    const renewalWindowMs = Number(process.env["GOOGLE_MAILBOX_WATCH_RENEWAL_WINDOW_MS"] || 24 * 60 * 60 * 1000);
    const now = Date.now();
    const mailboxes = await prisma.connectedMailbox.findMany({
        where: { provider: "GOOGLE_WORKSPACE", status: "CONNECTED" },
        orderBy: { updatedAt: "asc" },
        take: Math.max(limit * 4, limit),
    });

    const due = mailboxes.filter((mailbox: any) => {
        const metadata = mailbox.metadata && typeof mailbox.metadata === "object" ? mailbox.metadata : {};
        const expiresAt = metadata.gmailWatchExpirationAt ? Date.parse(String(metadata.gmailWatchExpirationAt)) : 0;
        return !expiresAt || expiresAt - now <= renewalWindowMs;
    }).slice(0, limit);

    const results: Array<{ mailboxId: string; teamId: string; renewed: boolean; error?: string }> = [];
    for (const mailbox of due) {
        try {
            await registerGoogleMailboxWatch(mailbox.teamId, mailbox.id);
            results.push({ mailboxId: mailbox.id, teamId: mailbox.teamId, renewed: true });
        } catch (error: any) {
            const reconnect = /reconnect|invalid_grant|unauthorized/i.test(error?.message || "");
            await prisma.connectedMailbox.update({
                where: { id: mailbox.id },
                data: {
                    status: reconnect ? "NEEDS_RECONNECT" : mailbox.status,
                    metadata: mergeMailboxMetadata(mailbox, {
                        lastWatchError: error?.message || "Unknown watch error",
                        lastWatchErrorAt: new Date().toISOString(),
                    }),
                },
            }).catch(() => undefined);
            results.push({ mailboxId: mailbox.id, teamId: mailbox.teamId, renewed: false, error: error?.message || "Unknown watch error" });
        }
    }
    return results;
}

export async function syncGoogleMailbox(teamId: string, mailboxId: string) {
    const mailbox = await prisma.connectedMailbox.findFirst({ where: { id: mailboxId, teamId } });
    if (!mailbox) throw new Error("Mailbox not found.");
    const accessToken = await getMailboxAccessToken(mailbox);
    if (!accessToken) throw new Error("Mailbox needs reconnect before sync.");

    const cursor = await getOrCreateMailboxCursor(mailbox);
    const startHistoryId = cursor.historyId || mailbox.historyId;
    let result: GmailSyncResult & { historyId?: string };
    if (startHistoryId) {
        try {
            result = await syncMailboxByHistory(accessToken, teamId, mailbox, startHistoryId);
        } catch (error: any) {
            if (error?.status !== 404) throw error;
            result = await syncMailboxByKnownThreads(accessToken, teamId, mailbox);
            const profile = await getGmailProfile(accessToken);
            result.historyId = profile.historyId || mailbox.historyId || undefined;
        }
    } else {
        result = await syncMailboxByKnownThreads(accessToken, teamId, mailbox);
        const profile = await getGmailProfile(accessToken);
        result.historyId = profile.historyId || undefined;
    }

    await prisma.connectedMailbox.update({
        where: { id: mailbox.id },
        data: {
            lastSyncAt: new Date(),
            historyId: result.historyId || mailbox.historyId,
            metadata: mergeMailboxMetadata(mailbox, {
                lastSyncError: null,
                lastSyncErrorAt: null,
            }),
        },
    });
    await updateMailboxCursor(mailbox, {
        historyId: result.historyId || mailbox.historyId,
        status: "IDLE",
        lastError: null,
        consecutiveFailures: 0,
    });

    return { synced: result.synced, replies: result.replies, bounces: result.bounces };
}

export async function syncDueGoogleMailboxes(limit = 25) {
    const now = new Date();
    const minIntervalMinutes = Number(process.env["GOOGLE_MAILBOX_SYNC_INTERVAL_MINUTES"] || 10);
    const dueBefore = new Date(now.getTime() - minIntervalMinutes * 60_000);
    const mailboxes = await prisma.connectedMailbox.findMany({
        where: {
            status: "CONNECTED",
            OR: [
                { lastSyncAt: null },
                { lastSyncAt: { lt: dueBefore } },
            ],
        },
        select: { id: true, teamId: true, metadata: true },
        orderBy: { lastSyncAt: "asc" },
        take: limit,
    });

    const results: Array<{ mailboxId: string; teamId: string; synced: number; replies: number; bounces: number; error?: string }> = [];
    for (const mailbox of mailboxes) {
        try {
            const result = await syncGoogleMailbox(mailbox.teamId, mailbox.id);
            results.push({ mailboxId: mailbox.id, teamId: mailbox.teamId, ...result });
        } catch (error: any) {
            await prisma.connectedMailbox.update({
                where: { id: mailbox.id },
                data: {
                    status: /reconnect|invalid_grant|unauthorized/i.test(error?.message || "") ? "NEEDS_RECONNECT" : "CONNECTED",
                    metadata: mergeMailboxMetadata(mailbox, { lastSyncError: error?.message || "Unknown sync error", lastSyncErrorAt: now.toISOString() }),
                },
            }).catch(() => undefined);
            await db.mailboxSyncCursor.updateMany({
                where: { mailboxId: mailbox.id, cursorType: "GMAIL_HISTORY" },
                data: {
                    status: "ERROR",
                    consecutiveFailures: { increment: 1 },
                    lastError: error?.message || "Unknown sync error",
                    lockExpiresAt: null,
                    lockedAt: null,
                },
            }).catch(() => undefined);
            results.push({ mailboxId: mailbox.id, teamId: mailbox.teamId, synced: 0, replies: 0, bounces: 0, error: error?.message || "Unknown sync error" });
        }
    }
    return results;
}

function decodePubSubData(data?: string) {
    if (!data) throw new Error("Missing Pub/Sub message data.");
    const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = Buffer.from(base64, "base64").toString("utf8");
    if (decoded.includes("\uFFFD")) {
        throw new Error("Invalid UTF-8 sequence.");
    }
    return JSON.parse(decoded) as { emailAddress?: string; historyId?: string };
}

export async function handleGooglePubSubNotification(message: GooglePubSubMessage) {
    let payload;
    try {
        payload = decodePubSubData(message.data);
    } catch (err: any) {
        return { accepted: false, reason: "PROCESSING_FAILURE" as const, error: err.message };
    }
    const email = payload.emailAddress ? normalizeEmailAddress(payload.emailAddress) : "";
    if (!email || !payload.historyId) {
        return { accepted: false, reason: "PROCESSING_FAILURE" as const, error: "missing_mailbox_or_history" };
    }

    let mailboxes;
    try {
        mailboxes = await prisma.connectedMailbox.findMany({
            where: { email, provider: "GOOGLE_WORKSPACE" },
        });
    } catch (err: any) {
        return { accepted: false, reason: "PROCESSING_FAILURE" as const, error: err.message };
    }

    if (mailboxes.length === 0) {
        return { accepted: false, reason: "UNKNOWN_MAILBOX" as const };
    }
    if (mailboxes.length > 1) {
        return { accepted: false, reason: "AMBIGUOUS_MAILBOX" as const };
    }

    const mailbox = mailboxes[0];

    try {
        let duplicate = false;
        if (message.messageId) {
            const existing = await prisma.emailEvent.findFirst({
                where: {
                    teamId: mailbox.teamId,
                    provider: "GOOGLE_PUBSUB",
                    providerMessageId: message.messageId,
                    type: "GMAIL_NOTIFICATION",
                },
                select: { id: true },
            });
            if (existing) {
                duplicate = true;
            } else {
                try {
                    await prisma.emailEvent.create({
                        data: {
                            teamId: mailbox.teamId,
                            mailboxId: mailbox.id,
                            type: "GMAIL_NOTIFICATION",
                            provider: "GOOGLE_PUBSUB",
                            providerMessageId: message.messageId,
                            payload: {
                                historyId: payload.historyId,
                            },
                        },
                    });
                } catch (error: any) {
                    if (error?.code === "P2002") {
                        duplicate = true;
                    } else {
                        throw error;
                    }
                }
            }
        }

        if (duplicate) {
            return { accepted: true, mailboxId: mailbox.id, teamId: mailbox.teamId, duplicate: true };
        }

        const syncResult = await syncGoogleMailbox(mailbox.teamId, mailbox.id);
        return { accepted: true, mailboxId: mailbox.id, teamId: mailbox.teamId, ...syncResult };
    } catch (error: any) {
        return { accepted: false, reason: "PROCESSING_FAILURE" as const, error: error?.message || "Unknown error" };
    }
}

export async function advanceMailboxWarmup() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return prisma.connectedMailbox.updateMany({
        where: {
            status: "CONNECTED",
            isWarmingUp: true,
            warmupDay: { lt: 30 },
            OR: [
                { warmupLastAdvancedAt: null },
                { warmupLastAdvancedAt: { lt: today } },
            ],
        },
        data: {
            warmupDay: { increment: 1 },
            warmupLastAdvancedAt: new Date(),
        },
    });
}
