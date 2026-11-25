
import { Prisma } from "@prisma/client";
import { decryptCredential, encryptCredential, type EncryptedCredential } from "@/lib/security/credentialVault";
import type { SmtpConfig } from "@/lib/email/smtpClient";
import { jsonObject } from "@/modules/overseer/mailboxReputationHold";

const API_URL = process.env['NEXT_PUBLIC_API_URL'] || '';
const ENCRYPTION_KEY = process.env["ENCRYPTION_KEY"] || "";
const isServer = typeof window === "undefined";

export interface StoredSmtpConfig {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    fromName: string;
    fromEmail: string;
}

type EncryptedSecret = {
    v: number;
    cipher: string;
    iv: string;
    tag: string;
};

type StoredSmtpRecord = StoredSmtpConfig & {
    password?: EncryptedSecret | string;
};

function getKey(): Buffer {
    if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(ENCRYPTION_KEY)) {
        throw new Error("ENCRYPTION_KEY must be a 64-character hex string");
    }
    return Buffer.from(ENCRYPTION_KEY, "hex");
}

async function encryptSecret(value: string): Promise<EncryptedSecret> {
    const crypto = await import("crypto");
    const key = getKey();
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

async function decryptSecret(secret?: EncryptedSecret | string): Promise<string | undefined> {
    if (!secret) return undefined;
    if (typeof secret === "string") return secret;
    if (secret.v !== 1) return undefined;
    const crypto = await import("crypto");
    const key = getKey();
    const iv = Buffer.from(secret.iv, "base64");
    const tag = Buffer.from(secret.tag, "base64");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([
        decipher.update(Buffer.from(secret.cipher, "base64")),
        decipher.final()
    ]);
    return decrypted.toString("utf8");
}

async function getTeamConfig(teamId: string): Promise<StoredSmtpRecord | null> {
    const { prisma } = await import("@/lib/db");
    const team = await prisma.team.findUnique({
        where: { id: teamId },
        select: { aiConfig: true }
    });
    return smtpRecord(team?.aiConfig);
}

function smtpRecord(aiConfig: unknown): StoredSmtpRecord | null {
    const config = jsonObject(aiConfig)["smtpConfig"];
    if (!config || typeof config !== "object" || Array.isArray(config)) return null;
    return config as unknown as StoredSmtpRecord;
}

async function decryptSmtpConfig(record: StoredSmtpRecord | null): Promise<SmtpConfig | null> {
    const password = await decryptSecret(record?.password);
    if (!record || !password || !record.host || !record.user || !record.fromEmail) return null;
    return { ...record, password };
}

function migratedMetadata(config: SmtpConfig, metadata?: unknown) {
    return { ...jsonObject(metadata), legacyTeamSmtp: true, host: config.host, port: config.port, secure: config.secure };
}

export async function ensureLegacySmtpMailbox(teamId: string) {
    const { prisma } = await import("@/lib/db");
    return prisma.$transaction(async (tx) => {
        await tx.$queryRaw(Prisma.sql`SELECT id FROM "Team" WHERE id = ${teamId} FOR UPDATE`);
        const team = await tx.team.findUnique({ where: { id: teamId }, select: { aiConfig: true } });
        const config = await decryptSmtpConfig(smtpRecord(team?.aiConfig));
        if (!config) return null;

        const email = config.fromEmail.trim().toLowerCase();
        const where = { teamId, email: { equals: email, mode: "insensitive" } } as const;
        const existing = await tx.connectedMailbox.findFirst({ where, select: { id: true, status: true, metadata: true } });
        if (existing) return { ...existing, config };

        const created = await tx.connectedMailbox.createMany({
            data: [{
                teamId, email, displayName: config.fromName || email, provider: "SMTP", authType: "BASIC", status: "CONNECTED",
                dailyLimit: 50, minDelaySeconds: 180,
                encryptedAccessToken: await encryptCredential(config.password),
                encryptedRefreshToken: await encryptCredential(config.user),
                metadata: migratedMetadata(config),
            }],
            skipDuplicates: true,
        });
        const mailbox = await tx.connectedMailbox.findFirstOrThrow({ where, select: { id: true, status: true, metadata: true } });
        if (created.count) await tx.auditLog.create({ data: {
            orgId: teamId, actorId: null, action: "LEGACY_SMTP_MAILBOX_CONNECTED", entity: "MailboxReputation",
            entityId: mailbox.id, metadata: { actor: "system", reason: "Apply standard mailbox pacing to the existing SMTP sender" },
        } });
        return { ...mailbox, config };
    });
}

async function setTeamConfig(teamId: string, config: StoredSmtpRecord | null): Promise<void> {
    const { prisma } = await import("@/lib/db");
    await prisma.$transaction(async (tx) => {
        await tx.$queryRaw(Prisma.sql`SELECT id FROM "Team" WHERE id = ${teamId} FOR UPDATE`);
        const team = await tx.team.findUnique({ where: { id: teamId }, select: { aiConfig: true } });
        const aiConfig = jsonObject(team?.aiConfig);
        if (config) aiConfig["smtpConfig"] = config as unknown as Prisma.JsonObject;
        else delete aiConfig["smtpConfig"];
        await tx.team.update({ where: { id: teamId }, data: { aiConfig } });

        const linked = await tx.connectedMailbox.findMany({
            where: { teamId, provider: "SMTP", metadata: { path: ["legacyTeamSmtp"], equals: true } },
            select: { id: true, email: true, metadata: true },
        });
        if (!linked.length) return;
        const configured = await decryptSmtpConfig(config);
        for (const mailbox of linked) {
            if (!configured || mailbox.email !== configured.fromEmail.trim().toLowerCase()) {
                await tx.connectedMailbox.update({ where: { id: mailbox.id }, data: {
                    status: "DISCONNECTED", encryptedAccessToken: Prisma.DbNull, encryptedRefreshToken: Prisma.DbNull,
                } });
                continue;
            }
            await tx.connectedMailbox.update({ where: { id: mailbox.id }, data: {
                displayName: configured.fromName || mailbox.email,
                encryptedAccessToken: await encryptCredential(configured.password),
                encryptedRefreshToken: await encryptCredential(configured.user),
                metadata: migratedMetadata(configured, mailbox.metadata),
            } });
        }
    });
}

export async function getSmtpConfig(teamId: string): Promise<any | null> {
    if (!teamId) return null;
    if (isServer) {
        const record = await getTeamConfig(teamId);
        if (!record) return null;
        return {
            host: record.host,
            port: record.port,
            secure: record.secure,
            user: record.user,
            password: await decryptSecret(record.password),
            fromName: record.fromName,
            fromEmail: record.fromEmail
        };
    }
    try {
        const res = await fetch(`${API_URL}/smtp/config?teamId=${teamId}`);
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

export async function saveSmtpConfig(teamId: string, config: any): Promise<void> {
    if (!teamId) return;
    if (isServer) {
        const record: StoredSmtpRecord = {
            host: config.host,
            port: config.port,
            secure: config.secure,
            user: config.user,
            fromName: config.fromName,
            fromEmail: config.fromEmail,
            ...(config.password ? { password: await encryptSecret(config.password) } : {})
        };
        await setTeamConfig(teamId, record);
        return;
    }
    await fetch(`${API_URL}/smtp/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, config })
    });
}

export async function deleteSmtpConfig(teamId: string): Promise<void> {
    if (!teamId) return;
    if (isServer) {
        await setTeamConfig(teamId, null);
        return;
    }
    await fetch(`${API_URL}/smtp/config`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId })
    });
}

export type SmtpMailboxSendOutcome =
    | { success: true; deliveryProvider: "SMTP"; messageId?: string; mailboxId: string }
    | { success: false; error: string; fallbackAllowed: boolean };

// Sends via a specific ConnectedMailbox's own credentials (metadata.host/port/secure +
// encryptedAccessToken, set by apps/web's /api/integrations/smtp/connect route) rather
// than the legacy single-per-team config above. Needed so Email.mailboxId gets populated
// for SMTP sends - the IMAP reply-sync worker matches replies by mailboxId, same as Gmail.
export async function sendViaSmtpMailbox(input: {
    teamId: string;
    mailboxId: string;
    to: string;
    subject: string;
    html: string;
    headers?: Record<string, string>;
    purpose?: import("@/modules/overseer/mailboxReputationHold").SendPurpose;
    attachments?: { filename: string; mimeType: string; content: string }[];
}): Promise<SmtpMailboxSendOutcome> {
    const { prisma } = await import("@/lib/db");
    const mailbox = await prisma.connectedMailbox.findFirst({
        where: { id: input.mailboxId, teamId: input.teamId, status: "CONNECTED", provider: "SMTP" },
    });
    if (!mailbox) {
        return { success: false, error: "SMTP_MAILBOX_PRE_DISPATCH_FAILED", fallbackAllowed: true };
    }

    const metadata = (mailbox.metadata as any) || {};
    const password = await decryptCredential(mailbox.encryptedAccessToken as EncryptedCredential | null);
    const user = metadata.legacyTeamSmtp || metadata.smtpLoginStored
        ? await decryptCredential(mailbox.encryptedRefreshToken as EncryptedCredential | null) : mailbox.email;
    if (!metadata.host || !password || !user) {
        return { success: false, error: "SMTP_MAILBOX_PRE_DISPATCH_FAILED", fallbackAllowed: true };
    }

    const { reserveMailboxSend, releaseMailboxSend } = await import("./googleMailboxService");
    const gate = await reserveMailboxSend(input.teamId, mailbox.id, input.purpose);
    if (!gate.ok) return { success: false, error: gate.reason, fallbackAllowed: false };

    const { sendViaSMTP } = await import("@/lib/email/smtpClient");
    const result = await sendViaSMTP(
        {
            host: metadata.host,
            port: metadata.port ?? 587,
            secure: Boolean(metadata.secure),
            user,
            password,
            fromName: mailbox.displayName || mailbox.email,
            fromEmail: mailbox.email,
        },
        {
            to: input.to,
            subject: input.subject,
            html: input.html,
            headers: input.headers,
            ...(input.attachments?.length ? { attachments: input.attachments } : {}),
        }
    );

    if (!result.success) {
        await releaseMailboxSend(input.teamId, mailbox.id);
        return { success: false, error: "SMTP_MAILBOX_SEND_FAILED", fallbackAllowed: true };
    }

    return {
        success: true,
        deliveryProvider: "SMTP",
        ...(result.messageId ? { messageId: result.messageId } : {}),
        mailboxId: mailbox.id,
    };
}

export async function getSmtpConfigRedacted(teamId: string): Promise<StoredSmtpConfig | null> {
    if (!teamId) return null;
    if (isServer) {
        const record = await getTeamConfig(teamId);
        if (!record) return null;
        return {
            host: record.host,
            port: record.port,
            secure: record.secure,
            user: record.user,
            fromName: record.fromName,
            fromEmail: record.fromEmail
        };
    }
    try {
        const res = await fetch(`${API_URL}/smtp/config/redacted?teamId=${teamId}`);
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}
