import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

// Mirrors the encrypt/decrypt pattern in modules/whatsapp/wabaCredentials.ts
// (AES-256-GCM, ENCRYPTION_KEY env var). Duplicated rather than imported -
// see leadStageTransitions.ts for the precedent of deliberate duplication
// over cross-module coupling in this repo.

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

export async function getTeamCrystalApiKey(teamId: string): Promise<string | undefined> {
    const team = await prisma.team.findUnique({
        where: { id: teamId },
        select: { crystalApiKeyEnc: true },
    });
    return decryptSecret(team?.crystalApiKeyEnc as any);
}

export async function teamHasCrystalApiKey(teamId: string): Promise<boolean> {
    const team = await prisma.team.findUnique({
        where: { id: teamId },
        select: { crystalApiKeyEnc: true },
    });
    return !!team?.crystalApiKeyEnc;
}

/** Verifies the key works by making a harmless lookup call before persisting it. */
export async function verifyCrystalApiKey(apiKey: string): Promise<{ ok: boolean; reason?: string }> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        // A lookup this specific will not match a real profile, so it never
        // spends a credit - GET /v4/profile only charges on a hit. A 404
        // ("not found") or 200 both prove the key authenticates; only a 401
        // means the key itself is bad.
        const response = await fetch(
            "https://api.crystalknows.com/v4/profile?full_name=" + encodeURIComponent("__crystal_key_verification_probe__"),
            { headers: { Authorization: `Bearer ${apiKey}` }, signal: controller.signal }
        );
        clearTimeout(timeout);

        if (response.status === 401) {
            return { ok: false, reason: "Crystal rejected this API key." };
        }
        if (!response.ok && response.status !== 404) {
            logger.warn(`[CrystalKnows] Credential verification failed with status ${response.status}`);
            return { ok: false, reason: `Crystal API returned an unexpected status (${response.status}).` };
        }
        return { ok: true };
    } catch (error: any) {
        logger.warn(`[CrystalKnows] Credential verification errored: ${error?.name === "AbortError" ? "timeout" : "network error"}`);
        return { ok: false, reason: "Could not reach the Crystal API to verify this key." };
    }
}

export async function setTeamCrystalApiKey(teamId: string, apiKey: string): Promise<void> {
    await prisma.team.update({
        where: { id: teamId },
        data: { crystalApiKeyEnc: encryptSecret(apiKey) as any, crystalApiKeyConfiguredAt: new Date() },
    });
}

export async function clearTeamCrystalApiKey(teamId: string): Promise<void> {
    await prisma.team.update({
        where: { id: teamId },
        data: { crystalApiKeyEnc: Prisma.JsonNull, crystalApiKeyConfiguredAt: null },
    });
}
