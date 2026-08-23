import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

// Mirrors the encrypt/decrypt pattern in email-campaigner/service/googleMailboxService.ts
// (AES-256-GCM, ENCRYPTION_KEY env var). Duplicated rather than imported since that
// module's helpers are private to the Gmail OAuth flow - see leadStageTransitions.ts
// for the precedent of deliberate duplication over cross-module coupling in this repo.

type EncryptedSecret = { v: 1; cipher: string; iv: string; tag: string };

function getEncryptionKey(): Buffer {
    const key = process.env["ENCRYPTION_KEY"];
    if (typeof key !== "string" || key.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(key)) {
        throw new Error("ENCRYPTION_KEY must be a 64-character hex string.");
    }
    return Buffer.from(key, "hex");
}

function encryptSecret(value: string): EncryptedSecret {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return { v: 1, cipher: encrypted.toString("base64"), iv: iv.toString("base64"), tag: tag.toString("base64") };
}

function decryptSecret(secret?: EncryptedSecret | null): string | undefined {
    if (!secret || secret.v !== 1) return undefined;
    const key = getEncryptionKey();
    const iv = Buffer.from(secret.iv, "base64");
    const tag = Buffer.from(secret.tag, "base64");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(Buffer.from(secret.cipher, "base64")), decipher.final()]);
    return decrypted.toString("utf8");
}

export type WabaConfig = { phoneNumberId: string; accessToken: string };

export async function getTeamWabaConfig(teamId: string): Promise<WabaConfig | null> {
    const team = await prisma.team.findUnique({
        where: { id: teamId },
        select: { whatsappPhoneNumberId: true, whatsappAccessTokenEnc: true },
    });
    if (!team?.whatsappPhoneNumberId || !team.whatsappAccessTokenEnc) return null;

    const accessToken = decryptSecret(team.whatsappAccessTokenEnc as any);
    if (!accessToken) return null;

    return { phoneNumberId: team.whatsappPhoneNumberId, accessToken };
}

export async function teamHasWaba(teamId: string): Promise<boolean> {
    const team = await prisma.team.findUnique({
        where: { id: teamId },
        select: { whatsappPhoneNumberId: true, whatsappAccessTokenEnc: true },
    });
    return !!(team?.whatsappPhoneNumberId && team.whatsappAccessTokenEnc);
}

/** Verifies credentials work by calling the Graph API before persisting them. */
export async function verifyWabaCredentials(phoneNumberId: string, accessToken: string): Promise<{ ok: boolean; reason?: string }> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}?fields=verified_name`, {
            headers: { Authorization: `Bearer ${accessToken}` },
            signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!response.ok) {
            // Never log the token or the response body - both can carry credential material.
            logger.warn(`[WABA] Credential verification failed with status ${response.status}`);
            return { ok: false, reason: `WhatsApp API rejected these credentials (status ${response.status}).` };
        }
        return { ok: true };
    } catch (error: any) {
        logger.warn(`[WABA] Credential verification errored: ${error?.name === "AbortError" ? "timeout" : "network error"}`);
        return { ok: false, reason: "Could not reach the WhatsApp API to verify credentials." };
    }
}

export async function setTeamWaba(teamId: string, phoneNumberId: string, accessToken: string): Promise<void> {
    await prisma.team.update({
        where: { id: teamId },
        data: {
            whatsappPhoneNumberId: phoneNumberId,
            whatsappAccessTokenEnc: encryptSecret(accessToken) as any,
            whatsappWabaConfiguredAt: new Date(),
        },
    });
}

export async function clearTeamWaba(teamId: string): Promise<void> {
    await prisma.team.update({
        where: { id: teamId },
        data: { whatsappPhoneNumberId: null, whatsappAccessTokenEnc: Prisma.JsonNull, whatsappWabaConfiguredAt: null },
    });
}
