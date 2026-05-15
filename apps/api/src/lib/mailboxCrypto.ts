import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getKey(): Buffer {
    const raw = process.env["MAILBOX_TOKEN_ENCRYPTION_KEY"] || process.env["ENCRYPTION_KEY"];
    if (!raw) {
        throw new Error("MAILBOX_TOKEN_ENCRYPTION_KEY is required for Gmail mailbox tokens.");
    }

    if (/^[a-f0-9]{64}$/i.test(raw)) {
        return Buffer.from(raw, "hex");
    }

    return crypto.createHash("sha256").update(raw).digest();
}

export function encryptSecret(value: string | null | undefined): string | null {
    if (!value) return null;
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptSecret(value: string | null | undefined): string | null {
    if (!value) return null;
    const [ivRaw, tagRaw, encryptedRaw] = value.split(".");
    if (!ivRaw || !tagRaw || !encryptedRaw) {
        throw new Error("Invalid encrypted secret format.");
    }

    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivRaw, "base64url"));
    decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
    const decrypted = Buffer.concat([
        decipher.update(Buffer.from(encryptedRaw, "base64url")),
        decipher.final(),
    ]);
    return decrypted.toString("utf8");
}

