import { beforeEach, describe, expect, it } from "vitest";
import { encryptClientSecret, decryptClientSecret } from "./ssoSecrets";

describe("ssoSecrets", () => {
    beforeEach(() => {
        process.env["ENCRYPTION_KEY"] = "a".repeat(64);
    });

    it("round-trips a secret through encrypt then decrypt", () => {
        const stored = encryptClientSecret("super-secret-value");
        expect(stored).not.toContain("super-secret-value");
        expect(decryptClientSecret(stored)).toBe("super-secret-value");
    });

    it("returns undefined for a missing value", () => {
        expect(decryptClientSecret(null)).toBeUndefined();
        expect(decryptClientSecret(undefined)).toBeUndefined();
    });

    it("falls back to returning the raw string for legacy plaintext secrets", () => {
        expect(decryptClientSecret("legacy-plaintext-secret")).toBe("legacy-plaintext-secret");
    });

    it("throws when ENCRYPTION_KEY is not a valid 64-char hex string", () => {
        process.env["ENCRYPTION_KEY"] = "too-short";
        expect(() => encryptClientSecret("value")).toThrow("ENCRYPTION_KEY must be a 64-character hex string.");
    });
});
