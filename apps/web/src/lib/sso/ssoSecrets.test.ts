import { describe, expect, it } from "vitest";
import { decryptClientSecret } from "./ssoSecrets";

describe("decryptClientSecret", () => {
    it("returns undefined for a missing value", () => {
        expect(decryptClientSecret(null)).toBeUndefined();
        expect(decryptClientSecret(undefined)).toBeUndefined();
    });

    it("falls back to returning the raw string for legacy plaintext secrets", () => {
        expect(decryptClientSecret("legacy-plaintext-secret")).toBe("legacy-plaintext-secret");
    });

    it("falls back to the raw string when it parses as JSON but isn't our encrypted shape", () => {
        expect(decryptClientSecret('{"foo":"bar"}')).toBe('{"foo":"bar"}');
    });
});
