import crypto from "crypto";

export type EncryptedCredential = {
    v: number;
    cipher: string;
    iv: string;
    tag: string;
};

function getEncryptionKey(): Buffer {
    const key = process.env["ENCRYPTION_KEY"] || "";
    if (!key || key.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(key)) {
        throw new Error("ENCRYPTION_KEY must be a 64-character hex string.");
    }
    return Buffer.from(key, "hex");
}

export function validateCredentialVaultKey(): { valid: boolean; error?: string } {
    const key = process.env["ENCRYPTION_KEY"] || "";
    if (!key) {
        return { valid: false, error: "ENCRYPTION_KEY environment variable is missing." };
    }
    if (key.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(key)) {
        return { valid: false, error: "ENCRYPTION_KEY must be a 64-character hex string." };
    }
    return { valid: true };
}

export async function encryptCredential(plaintext: string): Promise<EncryptedCredential> {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
        v: 1,
        cipher: encrypted.toString("base64"),
        iv: iv.toString("base64"),
        tag: tag.toString("base64"),
    };
}

export async function decryptCredential(secret?: EncryptedCredential | null): Promise<string | undefined> {
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
