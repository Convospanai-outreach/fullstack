/**
 * smtpConfigService.ts
 * Handles encrypted storage/retrieval of per-team SMTP credentials.
 * Stored in Team.aiConfig.smtpConfig as AES-256-CBC encrypted JSON.
 */
import crypto from "crypto";
import { prisma } from "@/lib/db";
import type { SmtpConfig } from "@/lib/email/smtpClient";

const ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16;

function getEncryptionKey(): Buffer {
    const key = process.env["ENCRYPTION_KEY"];
    if (!key) throw new Error("ENCRYPTION_KEY environment variable is not set");
    // Accept 32-byte hex string (64 chars) or raw 32-char string
    const buf = key.length === 64 ? Buffer.from(key, "hex") : Buffer.from(key.padEnd(32, "0").slice(0, 32));
    if (buf.length !== 32) throw new Error("ENCRYPTION_KEY must be 32 bytes");
    return buf;
}

function encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
}

function decrypt(ciphertext: string): string {
    const [ivHex, encHex] = ciphertext.split(":");
    if (!ivHex || !encHex) throw new Error("Invalid ciphertext format");
    const iv = Buffer.from(ivHex, "hex");
    const enc = Buffer.from(encHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

export interface StoredSmtpConfig {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    fromName: string;
    fromEmail: string;
    // password is stored separately, encrypted
}

/**
 * Retrieve and decrypt the stored SMTP config for a team.
 * Returns null if no config is stored.
 */
export async function getSmtpConfig(teamId: string): Promise<SmtpConfig | null> {
    const team = await prisma.team.findUnique({
        where: { id: teamId },
        select: { aiConfig: true },
    });
    if (!team) return null;

    const aiConfig = (team.aiConfig as any) ?? {};
    if (!aiConfig.smtpConfig) return null;

    const stored = aiConfig.smtpConfig as {
        host: string;
        port: number;
        secure: boolean;
        user: string;
        fromName: string;
        fromEmail: string;
        encryptedPassword: string;
    };

    try {
        const password = decrypt(stored.encryptedPassword);
        return {
            host: stored.host,
            port: stored.port,
            secure: stored.secure,
            user: stored.user,
            fromName: stored.fromName,
            fromEmail: stored.fromEmail,
            password,
        };
    } catch {
        return null;
    }
}

/**
 * Encrypt and save SMTP credentials for a team (merged into aiConfig).
 */
export async function saveSmtpConfig(teamId: string, config: SmtpConfig): Promise<void> {
    const team = await prisma.team.findUnique({
        where: { id: teamId },
        select: { aiConfig: true },
    });
    const currentAiConfig = (team?.aiConfig as any) ?? {};

    const encryptedPassword = encrypt(config.password);

    await prisma.team.update({
        where: { id: teamId },
        data: {
            aiConfig: {
                ...currentAiConfig,
                smtpConfig: {
                    host: config.host,
                    port: config.port,
                    secure: config.secure,
                    user: config.user,
                    fromName: config.fromName,
                    fromEmail: config.fromEmail,
                    encryptedPassword,
                },
            },
        },
    });
}

/**
 * Remove SMTP config for a team.
 */
export async function deleteSmtpConfig(teamId: string): Promise<void> {
    const team = await prisma.team.findUnique({
        where: { id: teamId },
        select: { aiConfig: true },
    });
    const currentAiConfig = (team?.aiConfig as any) ?? {};
    const { smtpConfig: _removed, ...rest } = currentAiConfig;

    await prisma.team.update({
        where: { id: teamId },
        data: { aiConfig: rest },
    });
}

/**
 * Return a redacted version of the stored config (no password) for UI prefill.
 */
export async function getSmtpConfigRedacted(teamId: string): Promise<StoredSmtpConfig | null> {
    const team = await prisma.team.findUnique({
        where: { id: teamId },
        select: { aiConfig: true },
    });
    if (!team) return null;
    const aiConfig = (team.aiConfig as any) ?? {};
    if (!aiConfig.smtpConfig) return null;
    const { encryptedPassword: _pw, ...redacted } = aiConfig.smtpConfig;
    return redacted as StoredSmtpConfig;
}
