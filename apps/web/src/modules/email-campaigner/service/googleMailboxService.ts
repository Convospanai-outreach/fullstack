import crypto from "crypto";
import { prisma } from "@/lib/db";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_MESSAGES_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages";

type EncryptedSecret = {
    v: number;
    cipher: string;
    iv: string;
    tag: string;
};

function getEncryptionKey(): Buffer {
    const key = process.env["ENCRYPTION_KEY"] || "";
    if (!key || key.length < 32) {
        throw new Error("ENCRYPTION_KEY must be set before sending through Google mailboxes.");
    }
    return Buffer.from(key, "hex");
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

async function decryptMailboxSecret(secret?: EncryptedSecret | null): Promise<string | undefined> {
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

function getGoogleConfig() {
    const clientId = process.env["GOOGLE_CLIENT_ID"];
    const clientSecret = process.env["GOOGLE_CLIENT_SECRET"];
    if (!clientId || !clientSecret) {
        throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured.");
    }
    return { clientId, clientSecret };
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
