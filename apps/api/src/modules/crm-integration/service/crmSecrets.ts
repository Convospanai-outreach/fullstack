import crypto from "crypto";

// Mirrors the AES-256-GCM / ENCRYPTION_KEY pattern used elsewhere in this repo
// (see ssoSecrets.ts, wabaCredentials.ts, smtpConfigService.ts) - duplicated per
// this repo's established precedent of duplication over cross-module coupling.
// CrmIntegration.accessToken/refreshToken are plain String columns (not Json),
// so the encrypted payload is JSON-stringified into them. These are live OAuth
// bearer tokens granting write access to the team's connected CRM account.

type EncryptedSecret = { v: 1; cipher: string; iv: string; tag: string };

function getEncryptionKey(): Buffer {
    const key = process.env["ENCRYPTION_KEY"];
    if (typeof key !== "string" || key.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(key)) {
        throw new Error("ENCRYPTION_KEY must be a 64-character hex string.");
    }
    return Buffer.from(key, "hex");
}

export function encryptCrmToken(value: string): string {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    const payload: EncryptedSecret = {
        v: 1,
        cipher: encrypted.toString("base64"),
        iv: iv.toString("base64"),
        tag: tag.toString("base64"),
    };
    return JSON.stringify(payload);
}

// Rows written before this fix still hold a plaintext token - falls back to
// returning the raw string so those integrations keep working until their next
// token refresh or reconnect.
export function decryptCrmToken(stored: string | null | undefined): string | undefined {
    if (!stored) return undefined;

    let payload: EncryptedSecret;
    try {
        payload = JSON.parse(stored);
        if (payload.v !== 1 || !payload.cipher || !payload.iv || !payload.tag) return stored;
    } catch {
        return stored;
    }

    const key = getEncryptionKey();
    const iv = Buffer.from(payload.iv, "base64");
    const tag = Buffer.from(payload.tag, "base64");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(Buffer.from(payload.cipher, "base64")), decipher.final()]);
    return decrypted.toString("utf8");
}
