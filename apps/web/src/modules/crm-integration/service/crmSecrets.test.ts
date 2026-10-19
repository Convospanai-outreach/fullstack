import { beforeEach, describe, expect, it } from "vitest";
import { encryptCrmToken, decryptCrmToken } from "./crmSecrets";

describe("crmSecrets", () => {
    beforeEach(() => {
        process.env["ENCRYPTION_KEY"] = "a".repeat(64);
    });

    it("round-trips a token through encrypt then decrypt", () => {
        const stored = encryptCrmToken("hubspot-access-token");
        expect(stored).not.toContain("hubspot-access-token");
        expect(decryptCrmToken(stored)).toBe("hubspot-access-token");
    });

    it("returns undefined for a missing value", () => {
        expect(decryptCrmToken(null)).toBeUndefined();
        expect(decryptCrmToken(undefined)).toBeUndefined();
    });

    it("falls back to returning the raw string for a legacy plaintext token", () => {
        expect(decryptCrmToken("legacy-plaintext-token")).toBe("legacy-plaintext-token");
    });

    it("throws when ENCRYPTION_KEY is not a valid 64-char hex string", () => {
        process.env["ENCRYPTION_KEY"] = "too-short";
        expect(() => encryptCrmToken("value")).toThrow("ENCRYPTION_KEY must be a 64-character hex string.");
    });
});
