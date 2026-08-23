import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import crypto from "crypto";
import { advanceLeadAfterReply } from "@/lib/crm/leadStageTransitions";

const db = prisma;

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

const GMAIL_CURSOR_TYPE = "GMAIL_HISTORY" as const;
const GMAIL_MAILBOX_LEASE_DURATION_MS = 10 * 60 * 1000;
const GMAIL_PROCESSING_HEARTBEAT_BATCH_SIZE = 25;
const GMAIL_RECOVERY_PAGE_SIZE = 250;
const GMAIL_RECOVERY_MAX_DATABASE_PAGES = 200;
const GMAIL_RECOVERY_MAX_RECORDS = 50_000;
const GMAIL_RECOVERY_MAX_UNIQUE_THREADS = 10_000;
const GMAIL_RECOVERY_MAX_ELAPSED_MS = 8 * 60 * 1000;
const GMAIL_REQUEST_TIMEOUT_MS = 60_000;
const GMAIL_OAUTH_STATE_NONCE_DOMAIN = "gmail-oauth-state-nonce:v1";

export type GmailMailboxLease = {
    mailboxId: string;
    cursorType: typeof GMAIL_CURSOR_TYPE;
    token: string;
    acquiredAt: Date;
    expiresAt: Date;
    startingHistoryId: string | null;
};

type GmailLeaseHeartbeat = () => Promise<void>;

export class GmailMailboxLeaseContendedError extends Error {
    constructor(mailboxId: string) {
        super(`Gmail mailbox lease is already owned for mailbox ${mailboxId}.`);
        this.name = "GmailMailboxLeaseContendedError";
    }
}

export class GmailMailboxLeaseLostError extends Error {
    constructor(mailboxId: string) {
        super(`Gmail mailbox lease ownership was lost for mailbox ${mailboxId}.`);
        this.name = "GmailMailboxLeaseLostError";
    }
}

export class GmailRecoveryLimitExceededError extends Error {
    constructor(limit: string) {
        super(`Gmail recovery safety limit exceeded: ${limit}.`);
        this.name = "GmailRecoveryLimitExceededError";
    }
}

export class GmailRecoveryCompletenessError extends Error {
    constructor() {
        super("Gmail recovery could not resolve a thread for an application-relevant outbound message.");
        this.name = "GmailRecoveryCompletenessError";
    }
}

export class GmailRecoveryUnresolvableRecordError extends Error {
    constructor(recordId: string) {
        super(`Gmail recovery record ${recordId} has no usable provider identifier.`);
        this.name = "GmailRecoveryUnresolvableRecordError";
    }
}

export class LegacyGmailEventAmbiguousError extends Error {
    constructor(emailEventId: string, reason: "missing_completion_evidence" | "missing_reply_message" = "missing_reply_message") {
        const detail = reason === "missing_completion_evidence"
            ? "has no durable completion evidence"
            : "has no deterministically linked reply Message";
        super(`Existing Gmail EmailEvent ${emailEventId} ${detail}.`);
        this.name = "LegacyGmailEventAmbiguousError";
    }
}

export class GmailRequestTimeoutError extends Error {
    constructor(operation: string) {
        super(`Gmail request timed out during ${operation}.`);
        this.name = "GmailRequestTimeoutError";
    }
}

export class GmailMailboxOwnershipConflictError extends Error {
    constructor() {
        super("This mailbox is already connected to another team.");
        this.name = "GmailMailboxOwnershipConflictError";
    }
}

class GmailCredentialRejectedError extends Error {
    constructor() {
        super("GOOGLE_TOKEN_REFRESH_CREDENTIAL_REJECTED");
        this.name = "GmailCredentialRejectedError";
    }
}

type GoogleRequestFailureCode =
    | "GOOGLE_OAUTH_CODE_EXCHANGE_TIMEOUT"
    | "GOOGLE_OAUTH_CODE_EXCHANGE_FAILED"
    | "GOOGLE_OAUTH_TOKEN_RESPONSE_INVALID"
    | "GMAIL_SEND_TIMEOUT"
    | "GMAIL_SEND_FAILED"
    | "GMAIL_SEND_RESPONSE_INVALID"
    | "GMAIL_WATCH_TIMEOUT"
    | "GMAIL_WATCH_FAILED"
    | "GMAIL_WATCH_RESPONSE_INVALID";

class GoogleRequestFailureError extends Error {
    constructor(readonly code: GoogleRequestFailureCode) {
        super(code);
        this.name = "GoogleRequestFailureError";
    }
}

class GoogleResponseInvalidError extends Error {
    constructor(operation: string) {
        super(`Google response was invalid during ${operation}.`);
        this.name = "GoogleResponseInvalidError";
    }
}

class GmailProviderRequestError extends Error {
    readonly status: number;

    constructor(operation: string, status: number) {
        super(`Gmail ${operation} request failed with HTTP ${status}.`);
        this.name = "GmailProviderRequestError";
        this.status = status;
    }
}

async function fetchGoogleJsonWithTimeout(url: string, init: RequestInit, operation: string) {
    const controller = new AbortController();
    const callerSignal = init.signal;
    const abortFromCaller = () => controller.abort();
    if (callerSignal?.aborted) controller.abort();
    else callerSignal?.addEventListener("abort", abortFromCaller, { once: true });
    const timeout = setTimeout(() => controller.abort(), GMAIL_REQUEST_TIMEOUT_MS);
    try {
        const { signal: _callerSignal, ...requestInit } = init;
        const response = await fetch(url, { ...requestInit, signal: controller.signal });
        let data: unknown = null;
        try {
            data = await response.json();
        } catch {
            if (!response.ok) return { response, data };
            throw new GoogleResponseInvalidError(operation);
        }
        return { response, data };
    } catch (error) {
        if (controller.signal.aborted) throw new GmailRequestTimeoutError(operation);
        throw error;
    } finally {
        clearTimeout(timeout);
        callerSignal?.removeEventListener("abort", abortFromCaller);
    }
}

function isGoogleResponseObject(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

function googleRequestFailure(
    error: unknown,
    timeoutCode: GoogleRequestFailureCode,
    failureCode: GoogleRequestFailureCode,
    responseInvalidCode = failureCode,
): GoogleRequestFailureError {
    if (error instanceof GoogleRequestFailureError) return error;
    if (error instanceof GoogleResponseInvalidError) return new GoogleRequestFailureError(responseInvalidCode);
    return new GoogleRequestFailureError(error instanceof GmailRequestTimeoutError ? timeoutCode : failureCode);
}

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

function digestOAuthStateNonce(nonce: string): string {
    const secret = getStateSecret();
    if (!secret) throw new Error("NEXTAUTH_SECRET or ENCRYPTION_KEY is required for Google OAuth state nonce protection.");
    return crypto.createHmac("sha256", secret)
        .update(`${GMAIL_OAUTH_STATE_NONCE_DOMAIN}:${nonce}`)
        .digest("hex");
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

    const nonceHash = digestOAuthStateNonce(nonce);
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
    try {
        const { response, data } = await fetchGoogleJsonWithTimeout(GOOGLE_TOKEN_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                code,
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUri,
                grant_type: "authorization_code",
            }),
        }, "OAuth code exchange");
        if (!response.ok) {
            throw new GoogleRequestFailureError("GOOGLE_OAUTH_CODE_EXCHANGE_FAILED");
        }
        if (!isGoogleResponseObject(data) || typeof data.access_token !== "string" || data.access_token.length === 0) {
            throw new GoogleRequestFailureError("GOOGLE_OAUTH_TOKEN_RESPONSE_INVALID");
        }
        return data as {
            access_token: string;
            refresh_token?: string;
            expires_in?: number;
            scope?: string;
            token_type?: string;
            id_token?: string;
        };
    } catch (error) {
        throw googleRequestFailure(
            error,
            "GOOGLE_OAUTH_CODE_EXCHANGE_TIMEOUT",
            "GOOGLE_OAUTH_CODE_EXCHANGE_FAILED",
            "GOOGLE_OAUTH_TOKEN_RESPONSE_INVALID",
        );
    }
}

async function getGmailProfile(accessToken: string): Promise<{ emailAddress: string; messagesTotal?: number; threadsTotal?: number; historyId?: string }> {
    const { response, data } = await fetchGoogleJsonWithTimeout(GMAIL_PROFILE_URL, {
        headers: { Authorization: `Bearer ${accessToken}` },
    }, "profile");
    if (!response.ok) {
        throw new GmailProviderRequestError("profile", response.status);
    }
    return data as { emailAddress: string; messagesTotal?: number; threadsTotal?: number; historyId?: string };
}

export async function connectGoogleMailbox(input: { code: string; state: string }) {
    const statePayload = verifyState(input.state);

    const identifier = `gmail-oauth-state:${statePayload.teamId}:${statePayload.userId}`;
    const nonceHash = digestOAuthStateNonce(statePayload.nonce);

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

    const existingMailbox = await prisma.connectedMailbox.findFirst({
        where: { email: normalizedEmail },
    });
    if (existingMailbox && existingMailbox.teamId !== statePayload.teamId) {
        throw new GmailMailboxOwnershipConflictError();
    }

    let finalEncryptedRefreshToken = encryptedRefreshToken;
    if (!finalEncryptedRefreshToken && existingMailbox?.encryptedRefreshToken) {
        finalEncryptedRefreshToken = existingMailbox.encryptedRefreshToken as any;
    }

    const hasRefreshToken = !!finalEncryptedRefreshToken;
    const status = hasRefreshToken ? "CONNECTED" : "NEEDS_RECONNECT";

    let mailbox;
    try {
        mailbox = await prisma.connectedMailbox.upsert({
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
                metadata: mergeMailboxMetadata(existingMailbox, {
                    messagesTotal: profile.messagesTotal,
                    threadsTotal: profile.threadsTotal,
                    reconnectedBy: statePayload.userId,
                }),
            },
        });
    } catch (error: any) {
        if (error?.code === "P2002") throw new GmailMailboxOwnershipConflictError();
        throw error;
    }

    if (process.env["GOOGLE_PUBSUB_TOPIC_NAME"] && finalEncryptedRefreshToken) {
        await registerGoogleMailboxWatch(statePayload.teamId, mailbox.id).catch(async (error) => {
            await prisma.connectedMailbox.update({
                where: { id: mailbox.id },
                data: {
                    metadata: mergeMailboxMetadata(mailbox, {
                        lastWatchError: safeGoogleWatchFailureCode(error),
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
            historyId: true,
            tokenExpiresAt: true,
            metadata: true,
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

export type GmailSendSuccess = {
    success: true;
    deliveryProvider: "GMAIL_API";
    messageId: string;
    threadId?: string;
    mailboxId: string;
};

export type GmailSendFailure = {
    success: false;
    error: "GMAIL_SEND_PRE_DISPATCH_FAILED" | "GMAIL_SEND_REJECTED" | "GMAIL_SEND_TIMEOUT" | "GMAIL_SEND_FAILED" | "GMAIL_SEND_RESPONSE_INVALID";
    outcome: "PRE_DISPATCH_NO_SEND" | "EXPLICIT_REJECTION" | "AMBIGUOUS";
    fallbackAllowed: boolean;
};

export type GmailSendOutcome = GmailSendSuccess | GmailSendFailure;

function gmailPreDispatchFailure(): GmailSendFailure {
    return {
        success: false,
        error: "GMAIL_SEND_PRE_DISPATCH_FAILED",
        outcome: "PRE_DISPATCH_NO_SEND",
        fallbackAllowed: true,
    };
}

function gmailExplicitRejection(): GmailSendFailure {
    return {
        success: false,
        error: "GMAIL_SEND_REJECTED",
        outcome: "EXPLICIT_REJECTION",
        fallbackAllowed: true,
    };
}

function gmailAmbiguousFailure(error: GmailSendFailure["error"]): GmailSendFailure {
    return {
        success: false,
        error,
        outcome: "AMBIGUOUS",
        fallbackAllowed: false,
    };
}

export async function sendViaGmailMailbox(input: {
    teamId: string;
    mailboxId: string;
    to: string;
    subject: string;
    html: string;
    replyTo?: string;
}): Promise<GmailSendOutcome> {
    let mailbox: any;
    let accessToken: string | undefined;
    let raw: string;
    let rfcMessageId: string;

    try {
        mailbox = await prisma.connectedMailbox.findFirst({
            where: { id: input.mailboxId, teamId: input.teamId, status: "CONNECTED" },
        });
        if (!mailbox) return gmailPreDispatchFailure();

        accessToken = await getMailboxAccessToken(mailbox);
        if (!accessToken) return gmailPreDispatchFailure();

        const fromName = mailbox.displayName || mailbox.email;
        const to = normalizeEmailAddress(input.to);
        const replyTo = input.replyTo ? normalizeEmailAddress(input.replyTo) : undefined;
        const domain = mailbox.email.split("@")[1] || "craftmyfunnel.live";
        rfcMessageId = `<${crypto.randomUUID()}@${domain}>`;
        const headers = [
            `From: "${encodeMimeHeader(fromName)}" <${mailbox.email}>`,
            `To: ${to}`,
            `Subject: ${encodeMimeHeader(input.subject)}`,
            `Message-ID: ${rfcMessageId}`,
            "MIME-Version: 1.0",
            "Content-Type: text/html; charset=UTF-8",
            ...(replyTo ? [`Reply-To: ${replyTo}`] : []),
        ];
        raw = base64Url(`${headers.join("\r\n")}\r\n\r\n${input.html}`);
    } catch {
        return gmailPreDispatchFailure();
    }

    let response: Response;
    let data: unknown;
    try {
        ({ response, data } = await fetchGoogleJsonWithTimeout(`${GMAIL_MESSAGES_URL}/send`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ raw }),
        }, "Gmail send"));
    } catch (error) {
        const failureCode = googleRequestFailure(
            error,
            "GMAIL_SEND_TIMEOUT",
            "GMAIL_SEND_FAILED",
            "GMAIL_SEND_RESPONSE_INVALID",
        ).code;
        return gmailAmbiguousFailure(
            failureCode === "GMAIL_SEND_TIMEOUT" || failureCode === "GMAIL_SEND_RESPONSE_INVALID"
                ? failureCode
                : "GMAIL_SEND_FAILED",
        );
    }

    if (!response.ok) {
        return response.status >= 400 && response.status < 500
            ? gmailExplicitRejection()
            : gmailAmbiguousFailure("GMAIL_SEND_FAILED");
    }
    if (!isGoogleResponseObject(data) || typeof data.id !== "string" || data.id.length === 0) {
        return gmailAmbiguousFailure("GMAIL_SEND_RESPONSE_INVALID");
    }

    let messageId = rfcMessageId;
    try {
        const sentMessage = await fetchGmailMessage(accessToken, data.id);
        const wireMessageId = headerValue(sentMessage, "Message-ID");
        if (wireMessageId) messageId = wireMessageId;
    } catch {
        console.error("[Gmail] GMAIL_SEND_MESSAGE_ID_FETCH_FAILED.");
    }

    const result: GmailSendSuccess = {
        success: true,
        deliveryProvider: "GMAIL_API",
        messageId,
        threadId: typeof data.threadId === "string" && data.threadId.length > 0 ? data.threadId : undefined,
        mailboxId: mailbox.id,
    };
    try {
        await markMailboxSend(input.teamId, mailbox.id);
    } catch {
        console.error("[Gmail] GMAIL_SEND_BOOKKEEPING_FAILED.");
    }
    return result;
}

type SuppressionInput = {
    teamId: string;
    email: string;
    reason: string;
    source: string;
    leadId?: string;
    createdBy?: string;
};

export async function recordSuppression(input: SuppressionInput) {
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

async function refreshAccessToken(mailbox: any, assertLeaseOwned?: GmailLeaseHeartbeat) {
    const refreshToken = await decryptMailboxSecret(mailbox.encryptedRefreshToken);
    if (!refreshToken) throw new Error("Mailbox needs reconnect before sync.");
    const { clientId, clientSecret } = getGoogleConfig();
    let response: Response;
    let data: any;
    try {
        ({ response, data } = await fetchGoogleJsonWithTimeout(GOOGLE_TOKEN_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                refresh_token: refreshToken,
                grant_type: "refresh_token",
            }),
        }, "token refresh"));
    } catch (error) {
        throw error;
    }
    if (!response.ok) {
        if (isExplicitCredentialRejection(data)) {
            if (assertLeaseOwned) await assertLeaseOwned();
            await markMailboxNeedsReconnect(mailbox, "GOOGLE_TOKEN_REFRESH_CREDENTIAL_REJECTED");
            throw new GmailCredentialRejectedError();
        }
        throw new GmailProviderRequestError("token refresh", response.status);
    }
    if (typeof data?.access_token !== "string" || data.access_token.length === 0) {
        if (isExplicitCredentialRejection(data)) {
            if (assertLeaseOwned) await assertLeaseOwned();
            await markMailboxNeedsReconnect(mailbox, "GOOGLE_TOKEN_REFRESH_CREDENTIAL_REJECTED");
            throw new GmailCredentialRejectedError();
        }
        throw new GoogleResponseInvalidError("token refresh");
    }
    if (assertLeaseOwned) await assertLeaseOwned();
    const encryptedAccessToken = await encryptSecret(data.access_token);
    const tokenExpiresAt = data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null;
    await prisma.connectedMailbox.update({
        where: { id: mailbox.id },
        data: { encryptedAccessToken, tokenExpiresAt },
    });
    return data.access_token as string;
}

function isExplicitCredentialRejection(data: unknown): boolean {
    return isGoogleResponseObject(data) && data.error === "invalid_grant";
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

async function getMailboxAccessToken(mailbox: any, assertLeaseOwned?: GmailLeaseHeartbeat) {
    if (mailbox.encryptedAccessToken && mailbox.tokenExpiresAt && mailbox.tokenExpiresAt > new Date(Date.now() + 60_000)) {
        return decryptMailboxSecret(mailbox.encryptedAccessToken);
    }
    return refreshAccessToken(mailbox, assertLeaseOwned);
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
    const { response, data } = await fetchGoogleJsonWithTimeout(`${GMAIL_MESSAGES_URL}/${encodeURIComponent(id)}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=Message-ID&metadataHeaders=In-Reply-To&metadataHeaders=References`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    }, "message lookup");
    if (!response.ok) {
        throw new GmailProviderRequestError("message lookup", response.status);
    }
    return data as any;
}

async function fetchGmailThread(accessToken: string, id: string) {
    const { response, data } = await fetchGoogleJsonWithTimeout(`${GMAIL_THREADS_URL}/${encodeURIComponent(id)}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=Message-ID&metadataHeaders=In-Reply-To&metadataHeaders=References`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    }, "thread lookup");
    if (!response.ok) {
        throw new GmailProviderRequestError("thread lookup", response.status);
    }
    return data as { messages?: any[] };
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

function parseGmailHistoryId(value: string, fieldName: string): bigint {
    if (!/^\d+$/.test(value)) {
        throw new Error(`${fieldName} must be a non-negative decimal integer string.`);
    }
    try {
        const parsed = BigInt(value);
        if (parsed < 0n) throw new Error("negative");
        return parsed;
    } catch {
        throw new Error(`${fieldName} must be a valid Gmail history ID.`);
    }
}

function safeGmailFailureCode(error: unknown): string {
    if (error instanceof GmailRecoveryLimitExceededError) return "GMAIL_RECOVERY_LIMIT_EXCEEDED";
    if (error instanceof GmailRecoveryCompletenessError) return "GMAIL_RECOVERY_INCOMPLETE";
    if (error instanceof GmailRecoveryUnresolvableRecordError) return "GMAIL_RECOVERY_UNRESOLVABLE_RECORD";
    if (error instanceof LegacyGmailEventAmbiguousError) return "GMAIL_LEGACY_EVENT_AMBIGUOUS";
    if (error instanceof GmailRequestTimeoutError) return "GMAIL_REQUEST_TIMEOUT";
    if (error instanceof GmailCredentialRejectedError) return "GOOGLE_TOKEN_REFRESH_CREDENTIAL_REJECTED";
    if (error instanceof GoogleResponseInvalidError) return "GMAIL_RESPONSE_INVALID";
    if (error instanceof GmailMailboxLeaseLostError) return "GMAIL_MAILBOX_LEASE_LOST";
    const status = typeof (error as any)?.status === "number" ? (error as any).status : undefined;
    return status ? `GMAIL_HTTP_${status}`.slice(0, 128) : "GMAIL_SYNC_FAILED";
}

function ownedLeaseWhere(lease: GmailMailboxLease) {
    return {
        mailboxId: lease.mailboxId,
        cursorType: lease.cursorType,
        lockToken: lease.token,
        status: "RUNNING",
    };
}

type GmailMailboxLeaseTransaction = Pick<Prisma.TransactionClient, "$queryRaw">;

export async function assertGmailMailboxLeaseInTransaction(
    tx: GmailMailboxLeaseTransaction,
    lease: GmailMailboxLease,
): Promise<void> {
    const ownedCursors = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "MailboxSyncCursor"
        WHERE "mailboxId" = ${lease.mailboxId}
          AND "cursorType" = ${lease.cursorType}
          AND "lockToken" = ${lease.token}
          AND "status" = 'RUNNING'
          AND "lockExpiresAt" IS NOT NULL
          AND "lockExpiresAt" > CURRENT_TIMESTAMP
        FOR UPDATE
    `;
    if (ownedCursors.length === 0) throw new GmailMailboxLeaseLostError(lease.mailboxId);
    if (ownedCursors.length !== 1) throw new Error("Mailbox cursor lease uniqueness invariant violated.");
}

export async function acquireGmailMailboxLease(mailbox: any): Promise<GmailMailboxLease> {
    await getOrCreateMailboxCursor(mailbox);
    const acquiredAt = new Date();
    const expiresAt = new Date(acquiredAt.getTime() + GMAIL_MAILBOX_LEASE_DURATION_MS);
    const token = crypto.randomUUID();
    const acquired = await db.mailboxSyncCursor.updateMany({
        where: {
            mailboxId: mailbox.id,
            cursorType: GMAIL_CURSOR_TYPE,
            OR: [
                { lockToken: null },
                {
                    lockToken: { not: null },
                    lockExpiresAt: { not: null, lte: acquiredAt },
                },
            ],
        },
        data: {
            lockToken: token,
            status: "RUNNING",
            lockedAt: acquiredAt,
            lockExpiresAt: expiresAt,
        },
    });
    if (acquired.count !== 1) throw new GmailMailboxLeaseContendedError(mailbox.id);

    const cursor = await db.mailboxSyncCursor.findUnique({
        where: { mailboxId_cursorType: { mailboxId: mailbox.id, cursorType: GMAIL_CURSOR_TYPE } },
        select: { historyId: true, lockToken: true },
    });
    if (!cursor || cursor.lockToken !== token) throw new GmailMailboxLeaseLostError(mailbox.id);
    return {
        mailboxId: mailbox.id,
        cursorType: GMAIL_CURSOR_TYPE,
        token,
        acquiredAt,
        expiresAt,
        startingHistoryId: cursor.historyId ?? null,
    };
}

export async function renewGmailMailboxLease(lease: GmailMailboxLease): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + GMAIL_MAILBOX_LEASE_DURATION_MS);
    const renewed = await db.mailboxSyncCursor.updateMany({
        where: { ...ownedLeaseWhere(lease), lockExpiresAt: { gt: now } },
        data: { lockExpiresAt: expiresAt },
    });
    if (renewed.count !== 1) throw new GmailMailboxLeaseLostError(lease.mailboxId);
    lease.expiresAt = expiresAt;
}

export async function assertGmailMailboxLeaseOwned(lease: GmailMailboxLease): Promise<void> {
    const owned = await db.mailboxSyncCursor.updateMany({
        where: { ...ownedLeaseWhere(lease), lockExpiresAt: { gt: new Date() } },
        data: { lockToken: lease.token },
    });
    if (owned.count !== 1) throw new GmailMailboxLeaseLostError(lease.mailboxId);
}

export async function commitGmailMailboxCursorAndRelease(
    mailbox: any,
    lease: GmailMailboxLease,
    finalHistoryId: string,
): Promise<void> {
    const finalValue = parseGmailHistoryId(finalHistoryId, "finalHistoryId");
    const startingValue = lease.startingHistoryId === null
        ? null
        : parseGmailHistoryId(lease.startingHistoryId, "startingHistoryId");
    if (startingValue !== null && finalValue < startingValue) {
        throw new Error("Gmail history cursor regression rejected.");
    }

    const syncedAt = new Date();
    await db.$transaction(async (tx) => {
        const committed = await tx.mailboxSyncCursor.updateMany({
            where: {
                ...ownedLeaseWhere(lease),
                lockExpiresAt: { gt: syncedAt },
                historyId: lease.startingHistoryId,
            },
            data: {
                historyId: finalHistoryId,
                status: "IDLE",
                lastSyncedAt: syncedAt,
                consecutiveFailures: 0,
                lastError: null,
                lockToken: null,
                lockedAt: null,
                lockExpiresAt: null,
            },
        });
        if (committed.count !== 1) throw new GmailMailboxLeaseLostError(lease.mailboxId);
        const mailboxUpdated = await tx.connectedMailbox.updateMany({
            where: { id: mailbox.id, teamId: mailbox.teamId },
            data: {
                lastSyncAt: syncedAt,
                historyId: finalHistoryId,
                metadata: mergeMailboxMetadata(mailbox, { lastSyncError: null, lastSyncErrorAt: null }),
            },
        });
        if (mailboxUpdated.count !== 1) throw new Error("Mailbox disappeared during Gmail cursor commit.");
    });
}

export async function releaseGmailMailboxLeaseAfterFailure(
    lease: GmailMailboxLease,
    error: unknown,
): Promise<void> {
    const released = await db.mailboxSyncCursor.updateMany({
        where: ownedLeaseWhere(lease),
        data: {
            status: "ERROR",
            consecutiveFailures: { increment: 1 },
            lastError: safeGmailFailureCode(error),
            lockToken: null,
            lockedAt: null,
            lockExpiresAt: null,
        },
    });
    if (released.count !== 1) throw new GmailMailboxLeaseLostError(lease.mailboxId);
}

function uniqueValues(values: Array<string | undefined | null>) {
    return [...new Set(values.filter(Boolean) as string[])];
}

async function listKnownOutboundEmailsPage(
    teamId: string,
    mailboxId: string,
    after?: { createdAt: Date; id: string },
) {
    return prisma.email.findMany({
        where: {
            mailboxId,
            deliveryProvider: "GMAIL_API",
            campaign: { teamId },
            AND: [
                ...(after ? [{
                    OR: [
                        { createdAt: { gt: after.createdAt } },
                        { createdAt: after.createdAt, id: { gt: after.id } },
                    ],
                }] : []),
            ],
        } as any,
        select: { id: true, createdAt: true, threadId: true, providerId: true },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: GMAIL_RECOVERY_PAGE_SIZE,
    });
}

type GmailInboundEventType = "REPLY_RECEIVED" | "BOUNCE";

type GmailInboundEventEvidence = {
    id: string;
    processedAt: Date | null;
    message: { id: string } | null;
};

function assertCompletedInboundEvent(
    existingEvent: GmailInboundEventEvidence,
    type: GmailInboundEventType,
): void {
    if (!existingEvent.processedAt) {
        throw new LegacyGmailEventAmbiguousError(existingEvent.id, "missing_completion_evidence");
    }
    if (type === "REPLY_RECEIVED" && !existingEvent.message) {
        throw new LegacyGmailEventAmbiguousError(existingEvent.id, "missing_reply_message");
    }
}

const GMAIL_DUPLICATE_COMPLETION_READ_ATTEMPTS = 3;
const GMAIL_DUPLICATE_COMPLETION_READ_DELAY_MS = 10;

async function waitForCompletedInboundEventAfterConflict(input: {
    teamId: string;
    providerMessageId: string;
    type: GmailInboundEventType;
    lease: GmailMailboxLease;
}): Promise<"duplicate"> {
    let lastEventId = "unknown";
    for (let attempt = 0; attempt < GMAIL_DUPLICATE_COMPLETION_READ_ATTEMPTS; attempt += 1) {
        try {
            const duplicate = await db.$transaction(async (tx) => {
                await assertGmailMailboxLeaseInTransaction(tx, input.lease);
                const existingEvent = await tx.emailEvent.findFirst({
                    where: {
                        teamId: input.teamId,
                        provider: "GMAIL_API",
                        providerMessageId: input.providerMessageId,
                        type: input.type,
                    },
                    select: { id: true, processedAt: true, message: { select: { id: true } } },
                });
                if (!existingEvent) return null;
                lastEventId = existingEvent.id;
                assertCompletedInboundEvent(existingEvent, input.type);
                return "duplicate" as const;
            });
            if (duplicate === "duplicate") return duplicate;
        } catch (error) {
            if (!(error instanceof LegacyGmailEventAmbiguousError) || attempt === GMAIL_DUPLICATE_COMPLETION_READ_ATTEMPTS - 1) {
                throw error;
            }
        }
        if (attempt < GMAIL_DUPLICATE_COMPLETION_READ_ATTEMPTS - 1) {
            await new Promise((resolve) => setTimeout(resolve, GMAIL_DUPLICATE_COMPLETION_READ_DELAY_MS));
        }
    }
    throw new LegacyGmailEventAmbiguousError(lastEventId, "missing_completion_evidence");
}

async function createInboundCampaignEvent(input: {
    teamId: string;
    mailbox: any;
    lease: GmailMailboxLease;
    message: any;
}): Promise<"reply" | "bounce" | "ignored" | "duplicate"> {
    const { teamId, mailbox, lease, message } = input;
    if (!hasReplyCorrelation(message)) return "ignored";
    const from = headerValue(message, "From") || "";
    const subject = headerValue(message, "Subject") || "";
    const fromEmail = extractEmailAddress(from);
    if (!fromEmail || fromEmail === mailbox.email.toLowerCase()) return "ignored";

    const isBounce = /mailer-daemon|postmaster/i.test(from) || /delivery status notification|undeliver|delivery failed|returned mail/i.test(subject);
    const type: GmailInboundEventType = isBounce ? "BOUNCE" : "REPLY_RECEIVED";
    try {
        return await db.$transaction(async (tx) => {
            await assertGmailMailboxLeaseInTransaction(tx, lease);
            const inReplyTo = headerValue(message, "In-Reply-To");
            const references = headerValue(message, "References") || "";
            const referenceTokens = references.split(/\s+/).map((value) => value.trim()).filter(Boolean);
            const providerIds = uniqueValues([inReplyTo, ...referenceTokens]);
            const matchedEmail = await tx.email.findFirst({
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
            if (!matchedEmail) return "ignored" as const;
            const existingEvent = await tx.emailEvent.findFirst({
                where: { teamId, provider: "GMAIL_API", providerMessageId: message.id, type },
                select: { id: true, processedAt: true, message: { select: { id: true } } },
            });
            if (existingEvent) {
                assertCompletedInboundEvent(existingEvent, type);
                return "duplicate" as const;
            }

            const emailEvent = await tx.emailEvent.create({
                data: {
                    teamId,
                    emailId: matchedEmail.id,
                    mailboxId: mailbox.id,
                    leadId: matchedEmail.leadId,
                    campaignId: matchedEmail.campaignId,
                    type,
                    provider: "GMAIL_API",
                    providerMessageId: message.id,
                    payload: { from, subject, threadId: message.threadId, gmailId: message.id },
                },
            });

            if (isBounce) {
                const lead = await tx.lead.findUnique({
                    where: { id: matchedEmail.leadId },
                    select: { email: true },
                });
                await tx.email.update({
                    where: { id: matchedEmail.id },
                    data: { bouncedAt: new Date(), status: "bounced" },
                });
                await tx.lead.update({
                    where: { id: matchedEmail.leadId },
                    data: { status: "STOPPED", updatedAt: new Date() },
                });
                await tx.connectedMailbox.update({
                    where: { id: mailbox.id },
                    data: { bounceCount: { increment: 1 } },
                });
                if (lead?.email) {
                    await tx.suppressionEntry.upsert({
                        where: { teamId_email: { teamId, email: lead.email.toLowerCase() } },
                        create: {
                            teamId,
                            email: lead.email.toLowerCase(),
                            reason: "BOUNCE",
                            source: "GMAIL_SYNC",
                            leadId: matchedEmail.leadId,
                        },
                        update: {
                            reason: "BOUNCE",
                            source: "GMAIL_SYNC",
                            leadId: matchedEmail.leadId,
                        },
                    });
                }
                await tx.emailEvent.update({
                    where: { id: emailEvent.id },
                    data: { processedAt: new Date() },
                });
                return "bounce" as const;
            }

            await tx.message.create({
                data: {
                    leadId: matchedEmail.leadId,
                    content: subject || "Reply detected",
                    direction: "INBOUND",
                    platform: "EMAIL",
                    sender: from,
                    status: "received",
                    isRead: false,
                    emailEventId: emailEvent.id,
                },
            });
            await tx.email.update({
                where: { id: matchedEmail.id },
                data: { repliedAt: new Date(), status: "replied" },
            });
            await advanceLeadAfterReply(tx, { leadId: matchedEmail.leadId, teamId });
            await tx.connectedMailbox.update({
                where: { id: mailbox.id },
                data: { replyCount: { increment: 1 } },
            });
            await tx.emailEvent.update({
                where: { id: emailEvent.id },
                data: { processedAt: new Date() },
            });
            return "reply" as const;
        });
    } catch (error: any) {
        if (isEmailEventUniqueDuplicate(error)) {
            return waitForCompletedInboundEventAfterConflict({
                teamId,
                providerMessageId: message.id,
                type,
                lease,
            });
        }
        throw error;
    }
}

function isEmailEventUniqueDuplicate(error: any): boolean {
    if (error?.code !== "P2002") return false;
    const expected = ["teamId", "provider", "providerMessageId", "type"];
    const target = error.meta?.target;
    if (Array.isArray(target)) {
        return target.length === expected.length && expected.every((field) => target.includes(field));
    }
    if (typeof target !== "string") return false;
    const normalized = target.toLowerCase().replace(/[^a-z0-9]/g, "");
    return normalized === "emaileventteamidproviderprovidermessageidtypekey";
}

async function processGmailMessages(
    accessToken: string,
    teamId: string,
    mailbox: any,
    messageIds: string[],
    lease: GmailMailboxLease,
    heartbeat: GmailLeaseHeartbeat,
): Promise<GmailSyncResult> {
    let replies = 0;
    let bounces = 0;
    let synced = 0;
    const uniqueMessageIds = uniqueValues(messageIds);
    for (let index = 0; index < uniqueMessageIds.length; index += 1) {
        if (index % GMAIL_PROCESSING_HEARTBEAT_BATCH_SIZE === 0) await heartbeat();
        const messageId = uniqueMessageIds[index];
        const message = await fetchGmailMessage(accessToken, messageId);
        await heartbeat();
        const result = await createInboundCampaignEvent({ teamId, mailbox, lease, message });
        if (result === "reply") replies += 1;
        if (result === "bounce") bounces += 1;
        if (result === "reply" || result === "bounce") synced += 1;
    }
    return { synced, replies, bounces };
}

function assertRecoveryWithinBounds(startedAt: number, limitName = "elapsed time") {
    if (Date.now() - startedAt > GMAIL_RECOVERY_MAX_ELAPSED_MS) {
        throw new GmailRecoveryLimitExceededError(limitName);
    }
}

function addRecoveryThread(threadIds: Set<string>, threadId: string) {
    threadIds.add(threadId);
    if (threadIds.size > GMAIL_RECOVERY_MAX_UNIQUE_THREADS) {
        throw new GmailRecoveryLimitExceededError("unique Gmail threads");
    }
}

async function syncMailboxByKnownThreads(
    accessToken: string,
    teamId: string,
    mailbox: any,
    lease: GmailMailboxLease,
    heartbeat: GmailLeaseHeartbeat,
): Promise<GmailSyncResult> {
    const startedAt = Date.now();
    const threadIds = new Set<string>();
    const providerMessageIds = new Map<string, string>();
    let after: { createdAt: Date; id: string } | undefined;
    let databasePages = 0;
    let recordsInspected = 0;

    while (true) {
        assertRecoveryWithinBounds(startedAt);
        if (databasePages >= GMAIL_RECOVERY_MAX_DATABASE_PAGES) {
            throw new GmailRecoveryLimitExceededError("database pages");
        }
        await heartbeat();
        const page = await listKnownOutboundEmailsPage(teamId, mailbox.id, after);
        databasePages += 1;
        recordsInspected += page.length;
        if (recordsInspected > GMAIL_RECOVERY_MAX_RECORDS) {
            throw new GmailRecoveryLimitExceededError("records inspected");
        }
        for (const record of page) {
            if (record.threadId) addRecoveryThread(threadIds, record.threadId);
            else if (record.providerId) providerMessageIds.set(record.providerId, record.id);
            else throw new GmailRecoveryUnresolvableRecordError(record.id);
        }
        if (page.length < GMAIL_RECOVERY_PAGE_SIZE) break;
        const last = page[page.length - 1];
        after = { createdAt: last.createdAt, id: last.id };
    }

    const providerRecords = [...providerMessageIds.entries()];
    for (let offset = 0; offset < providerRecords.length; offset += GMAIL_PROCESSING_HEARTBEAT_BATCH_SIZE) {
        assertRecoveryWithinBounds(startedAt);
        await heartbeat();
        for (const [providerId, recordId] of providerRecords.slice(offset, offset + GMAIL_PROCESSING_HEARTBEAT_BATCH_SIZE)) {
            let message: any;
            try {
                message = await fetchGmailMessage(accessToken, providerId);
            } catch (error) {
                if (error instanceof GmailProviderRequestError && error.status === 404) {
                    throw new GmailRecoveryUnresolvableRecordError(recordId);
                }
                throw error;
            }
            await heartbeat();
            if (!message.threadId) throw new GmailRecoveryUnresolvableRecordError(recordId);
            addRecoveryThread(threadIds, message.threadId);
        }
    }

    let replies = 0;
    let bounces = 0;
    let synced = 0;
    const uniqueThreadIds = [...threadIds];
    for (let offset = 0; offset < uniqueThreadIds.length; offset += GMAIL_PROCESSING_HEARTBEAT_BATCH_SIZE) {
        assertRecoveryWithinBounds(startedAt);
        await heartbeat();
        for (const threadId of uniqueThreadIds.slice(offset, offset + GMAIL_PROCESSING_HEARTBEAT_BATCH_SIZE)) {
            const thread = await fetchGmailThread(accessToken, threadId);
            await heartbeat();
            const messages = thread.messages || [];
            for (let index = 0; index < messages.length; index += 1) {
                if (index > 0 && index % GMAIL_PROCESSING_HEARTBEAT_BATCH_SIZE === 0) await heartbeat();
                const result = await createInboundCampaignEvent({ teamId, mailbox, lease, message: messages[index] });
                if (result === "reply") replies += 1;
                if (result === "bounce") bounces += 1;
                if (result === "reply" || result === "bounce") synced += 1;
            }
        }
    }
    return { synced, replies, bounces };
}

async function syncMailboxByHistory(
    accessToken: string,
    teamId: string,
    mailbox: any,
    startHistoryId: string,
    lease: GmailMailboxLease,
    heartbeat: GmailLeaseHeartbeat,
): Promise<GmailSyncResult & { historyId?: string }> {
    let pageToken: string | undefined;
    let historyId: string | undefined;
    const messageIds: string[] = [];
    do {
        await heartbeat();
        const params = new URLSearchParams({
            startHistoryId,
            historyTypes: "messageAdded",
            labelId: "INBOX",
        });
        if (pageToken) params.set("pageToken", pageToken);
        const { response, data } = await fetchGoogleJsonWithTimeout(`${GMAIL_HISTORY_URL}?${params.toString()}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        }, "history lookup");
        if (!response.ok) {
            throw new GmailProviderRequestError("history lookup", response.status);
        }
        await heartbeat();
        const history = data as { historyId?: string; history?: Array<{ messagesAdded?: Array<{ message?: { id?: string } }> }>; nextPageToken?: string };
        historyId = history.historyId || historyId;
        for (const record of history.history || []) {
            for (const added of record.messagesAdded || []) {
                if (added?.message?.id) messageIds.push(added.message.id);
            }
        }
        pageToken = history.nextPageToken;
    } while (pageToken);

    return { ...(await processGmailMessages(accessToken, teamId, mailbox, messageIds, lease, heartbeat)), historyId };
}

export async function registerGoogleMailboxWatch(teamId: string, mailboxId: string) {
    const mailbox = await prisma.connectedMailbox.findFirst({ where: { id: mailboxId, teamId } });
    if (!mailbox) throw new Error("Mailbox not found.");
    const accessToken = await getMailboxAccessToken(mailbox);
    if (!accessToken) throw new Error("Mailbox needs reconnect before sync.");

    const topicName = process.env["GOOGLE_PUBSUB_TOPIC_NAME"];
    if (!topicName) throw new Error("GOOGLE_PUBSUB_TOPIC_NAME must be configured for Gmail watch.");
    let response: Response;
    let data: unknown;
    try {
        ({ response, data } = await fetchGoogleJsonWithTimeout(GMAIL_WATCH_URL, {
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
        }, "Gmail watch registration"));
    } catch (error) {
        throw googleRequestFailure(error, "GMAIL_WATCH_TIMEOUT", "GMAIL_WATCH_FAILED", "GMAIL_WATCH_RESPONSE_INVALID");
    }
    if (!response.ok) throw new GoogleRequestFailureError("GMAIL_WATCH_FAILED");
    if (!isGoogleResponseObject(data)) throw new GoogleRequestFailureError("GMAIL_WATCH_RESPONSE_INVALID");
    if (data.historyId !== undefined && (typeof data.historyId !== "string" || data.historyId.length === 0)) {
        throw new GoogleRequestFailureError("GMAIL_WATCH_RESPONSE_INVALID");
    }
    let watchExpirationAt: Date | null = null;
    if (data.expiration !== undefined) {
        const expirationMs = typeof data.expiration === "string" || typeof data.expiration === "number"
            ? Number(data.expiration)
            : Number.NaN;
        if (!Number.isFinite(expirationMs)) throw new GoogleRequestFailureError("GMAIL_WATCH_RESPONSE_INVALID");
        watchExpirationAt = new Date(expirationMs);
    }
    const historyId = typeof data.historyId === "string" ? data.historyId : mailbox.historyId;
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
    await getOrCreateMailboxCursor(updated);
    return { mailboxId: mailbox.id, historyId, watchExpirationAt };
}

function safeGoogleWatchFailureCode(error: unknown): "GMAIL_WATCH_TIMEOUT" | "GMAIL_WATCH_FAILED" | "GMAIL_WATCH_RESPONSE_INVALID" {
    if (error instanceof GoogleRequestFailureError) {
        if (error.code === "GMAIL_WATCH_TIMEOUT" || error.code === "GMAIL_WATCH_RESPONSE_INVALID") return error.code;
        if (error.code === "GMAIL_WATCH_FAILED") return error.code;
    }
    if (error instanceof GmailRequestTimeoutError) return "GMAIL_WATCH_TIMEOUT";
    return "GMAIL_WATCH_FAILED";
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
        } catch (error) {
            const errorCode = safeGoogleWatchFailureCode(error);
            await prisma.connectedMailbox.update({
                where: { id: mailbox.id },
                data: {
                    metadata: mergeMailboxMetadata(mailbox, {
                        lastWatchError: errorCode,
                        lastWatchErrorAt: new Date().toISOString(),
                    }),
                },
            }).catch(() => undefined);
            results.push({ mailboxId: mailbox.id, teamId: mailbox.teamId, renewed: false, error: errorCode });
        }
    }
    return results;
}

export async function syncGoogleMailbox(
    teamId: string,
    mailboxId: string,
    options: { lease?: GmailMailboxLease } = {},
) {
    const mailbox = await prisma.connectedMailbox.findFirst({ where: { id: mailboxId, teamId } });
    if (!mailbox) throw new Error("Mailbox not found.");
    if (mailbox.provider !== "GOOGLE_WORKSPACE") throw new Error("Mailbox is not a Google Workspace mailbox.");
    const lease = options.lease ?? await acquireGmailMailboxLease(mailbox);
    if (lease.mailboxId !== mailbox.id || lease.cursorType !== GMAIL_CURSOR_TYPE) {
        throw new GmailMailboxLeaseLostError(mailbox.id);
    }
    const heartbeat = () => renewGmailMailboxLease(lease);

    try {
        await assertGmailMailboxLeaseOwned(lease);
        const accessToken = await getMailboxAccessToken(mailbox, heartbeat);
        await heartbeat();
        if (!accessToken) throw new Error("Mailbox needs reconnect before sync.");
        const startHistoryId = lease.startingHistoryId;
        let result: GmailSyncResult & { historyId?: string };
        if (startHistoryId) {
            parseGmailHistoryId(startHistoryId, "startingHistoryId");
            try {
                result = await syncMailboxByHistory(accessToken, teamId, mailbox, startHistoryId, lease, heartbeat);
            } catch (error: any) {
                if (error?.status !== 404 && error?.status !== 400) throw error;
                result = await syncMailboxByKnownThreads(accessToken, teamId, mailbox, lease, heartbeat);
                const profile = await getGmailProfile(accessToken);
                await heartbeat();
                result.historyId = profile.historyId;
            }
        } else {
            result = await syncMailboxByKnownThreads(accessToken, teamId, mailbox, lease, heartbeat);
            const profile = await getGmailProfile(accessToken);
            await heartbeat();
            result.historyId = profile.historyId;
        }
        const finalHistoryId = result.historyId || startHistoryId;
        if (!finalHistoryId) throw new Error("Gmail sync completed without a history ID.");
        await heartbeat();
        await commitGmailMailboxCursorAndRelease(mailbox, lease, finalHistoryId);
        return { synced: result.synced, replies: result.replies, bounces: result.bounces };
    } catch (error) {
        if (error instanceof GmailMailboxLeaseLostError) throw error;
        try {
            await releaseGmailMailboxLeaseAfterFailure(lease, error);
        } catch (releaseError) {
            if (releaseError instanceof GmailMailboxLeaseLostError) throw releaseError;
            throw releaseError;
        }
        throw error;
    }
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
            const safeError = safeGmailFailureCode(error);
            await prisma.connectedMailbox.update({
                where: { id: mailbox.id },
                data: {
                    metadata: mergeMailboxMetadata(mailbox, { lastSyncError: safeError, lastSyncErrorAt: now.toISOString() }),
                },
            }).catch(() => undefined);
            results.push({ mailboxId: mailbox.id, teamId: mailbox.teamId, synced: 0, replies: 0, bounces: 0, error: safeError });
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

export async function resolveGoogleMailbox(email: string) {
    const normalized = normalizeEmailAddress(email);
    const mailboxes = await prisma.connectedMailbox.findMany({
        where: { email: normalized, provider: "GOOGLE_WORKSPACE" },
    });
    if (mailboxes.length === 0) {
        return { status: "UNKNOWN_MAILBOX" as const };
    }
    if (mailboxes.length > 1) {
        return { status: "AMBIGUOUS_MAILBOX" as const };
    }
    return { status: "RESOLVED" as const, mailbox: mailboxes[0] };
}

export async function handleGooglePubSubNotification(message: GooglePubSubMessage) {
    let payload;
    try {
        payload = decodePubSubData(message.data);
    } catch (err: any) {
        return { accepted: false, reason: "PROCESSING_FAILURE" as const, error: err.message };
    }
    const email = payload.emailAddress || "";
    if (!email || !payload.historyId) {
        return { accepted: false, reason: "PROCESSING_FAILURE" as const, error: "missing_mailbox_or_history" };
    }

    let resolution;
    try {
        resolution = await resolveGoogleMailbox(email);
    } catch (err: any) {
        return { accepted: false, reason: "PROCESSING_FAILURE" as const, error: err.message };
    }

    if (resolution.status === "UNKNOWN_MAILBOX") {
        return { accepted: false, reason: "UNKNOWN_MAILBOX" as const };
    }
    if (resolution.status === "AMBIGUOUS_MAILBOX") {
        return { accepted: false, reason: "AMBIGUOUS_MAILBOX" as const };
    }

    const mailbox = resolution.mailbox;

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
                    if (isEmailEventUniqueDuplicate(error)) {
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
