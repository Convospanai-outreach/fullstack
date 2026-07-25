import crypto from "crypto";
import { prisma } from "@/lib/db";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_MESSAGES_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages";
const GMAIL_PROFILE_URL = "https://gmail.googleapis.com/gmail/v1/users/me/profile";

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

import { encryptCredential, decryptCredential, EncryptedCredential } from "@/lib/security/credentialVault";

export async function decryptMailboxSecret(secret?: EncryptedCredential | null): Promise<string | undefined> {
    return decryptCredential(secret);
}

async function encryptSecret(value: string): Promise<EncryptedCredential> {
    return encryptCredential(value);
}

function getGoogleConfig() {
    const clientId = process.env["GOOGLE_CLIENT_ID"];
    const clientSecret = process.env["GOOGLE_CLIENT_SECRET"];
    const redirectUri = process.env["GOOGLE_GMAIL_REDIRECT_URI"] || "https://api.craftmyfunnel.live/integrations/google/oauth/callback";
    if (!clientId || !clientSecret) {
        throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured.");
    }
    return { clientId, clientSecret, redirectUri };
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

function getStateSecret(): string | undefined {
    return process.env["NEXTAUTH_SECRET"] || process.env["ENCRYPTION_KEY"];
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
    if (!payload || typeof payload !== "object" || !payload.teamId || !payload.userId) {
        throw new Error("Invalid OAuth state structure.");
    }
    return payload;
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

export async function connectGoogleMailbox(input: { code: string; state: string }) {
    const statePayload = verifyState(input.state);
    const { clientId, clientSecret, redirectUri } = getGoogleConfig();

    const response = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            code: input.code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: "authorization_code",
        }),
    });
    const token = await response.json() as any;
    if (!response.ok) {
        throw new Error(token?.error_description || token?.error || "Google token exchange failed.");
    }

    const profileRes = await fetch(GMAIL_PROFILE_URL, {
        headers: { Authorization: `Bearer ${token.access_token}` },
    });
    const profile = await profileRes.json() as any;
    if (!profileRes.ok || !profile.emailAddress) {
        throw new Error("Unable to fetch Gmail profile.");
    }

    const email = profile.emailAddress.toLowerCase();
    const encryptedAccessToken = await encryptSecret(token.access_token);
    const encryptedRefreshToken = token.refresh_token ? await encryptSecret(token.refresh_token) : undefined;
    const tokenExpiresAt = token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null;

    const existingMailbox = await prisma.connectedMailbox.findFirst({ where: { email } });
    if (existingMailbox && existingMailbox.teamId !== statePayload.teamId) {
        throw new Error("Mailbox is already connected to another team.");
    }

    const mailbox = existingMailbox
        ? await prisma.connectedMailbox.update({
              where: { id: existingMailbox.id },
              data: {
                  status: "CONNECTED",
                  encryptedAccessToken,
                  ...(encryptedRefreshToken ? { encryptedRefreshToken } : {}),
                  tokenExpiresAt,
              },
          })
        : await prisma.connectedMailbox.create({
              data: {
                  teamId: statePayload.teamId,
                  email,
                  status: "CONNECTED",
                  encryptedAccessToken,
                  ...(encryptedRefreshToken ? { encryptedRefreshToken } : {}),
                  tokenExpiresAt,
              },
          });

    return { mailbox, nextPath: statePayload.nextPath };
}

async function refreshAccessToken(mailbox: any) {
    const refreshToken = await decryptMailboxSecret(mailbox.encryptedRefreshToken);
    if (!refreshToken) throw new Error("Mailbox needs reconnect before send.");

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
        await prisma.connectedMailbox.update({
            where: { id: mailbox.id },
            data: { status: "NEEDS_RECONNECT" },
        }).catch(() => undefined);
        throw new Error(data?.error_description || data?.error || "Google token refresh failed.");
    }

    const encryptedAccessToken = await encryptSecret(data.access_token);
    const tokenExpiresAt = data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null;
    await prisma.connectedMailbox.update({
        where: { id: mailbox.id },
        data: { encryptedAccessToken, tokenExpiresAt, status: "CONNECTED" },
    });
    return data.access_token as string;
}

async function getMailboxAccessToken(mailbox: any) {
    if (mailbox.encryptedAccessToken && mailbox.tokenExpiresAt && mailbox.tokenExpiresAt > new Date(Date.now() + 60_000)) {
        return decryptMailboxSecret(mailbox.encryptedAccessToken);
    }
    return refreshAccessToken(mailbox);
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
