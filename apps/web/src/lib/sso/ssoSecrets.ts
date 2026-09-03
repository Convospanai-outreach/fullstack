import crypto from "crypto";

// Decrypt-only mirror of apps/api/src/modules/settings/ssoSecrets.ts (which owns
// encryption, on save). Duplicated per this repo's established precedent of
// duplication over cross-module coupling between the two apps.

type EncryptedSecret = { v: 1; cipher: string; iv: string; tag: string };

function getEncryptionKey(): Buffer {
    const key = process.env["ENCRYPTION_KEY"];
    if (typeof key !== "string" || key.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(key)) {
        throw new Error("ENCRYPTION_KEY must be a 64-character hex string.");
    }
    return Buffer.from(key, "hex");
}

// Rows written before encryption was added still hold a plaintext secret - falls
// back to returning the raw string so those configs keep working until their next save.
export function decryptClientSecret(stored: string | null | undefined): string | undefined {
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
