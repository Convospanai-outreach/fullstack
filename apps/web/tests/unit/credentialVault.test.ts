import { describe, it, expect, beforeEach } from "vitest";
import { encryptCredential, decryptCredential, validateCredentialVaultKey } from "@/lib/security/credentialVault";

describe("CredentialVault (AES-256-GCM)", () => {
    beforeEach(() => {
        process.env["ENCRYPTION_KEY"] = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    });

    it("validates key presence and minimum entropy", () => {
        const check = validateCredentialVaultKey();
        expect(check.valid).toBe(true);
    });

    it("encrypts and decrypts secret correctly", async () => {
        const secret = "super-secret-smtp-password-123";
        const encrypted = await encryptCredential(secret);

        expect(encrypted.v).toBe(1);
        expect(encrypted.cipher).toBeDefined();
        expect(encrypted.iv).toBeDefined();
        expect(encrypted.tag).toBeDefined();

        const decrypted = await decryptCredential(encrypted);
        expect(decrypted).toBe(secret);
    });

    it("fails decryption if auth tag is tampered", async () => {
        const secret = "tamper-test";
        const encrypted = await encryptCredential(secret);

        // Tamper with tag
        encrypted.tag = Buffer.from("invalid-auth-tag-1234").toString("base64");

        await expect(decryptCredential(encrypted)).rejects.toThrow();
    });
});
