import { afterEach, describe, expect, it, vi } from "vitest";
import { isKnownExtensionId, knownExtensionIds, STORE_EXTENSION_ID } from "./extensionIds";

const DEV_ID = "abcdefghijklmnopabcdefghijklmnop";

describe("knownExtensionIds", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("always includes the Chrome Web Store build", () => {
        vi.stubEnv("EXTENSION_IDS", "");
        expect(knownExtensionIds()).toEqual([STORE_EXTENSION_ID]);
        expect(STORE_EXTENSION_ID).toMatch(/^[a-p]{32}$/);
    });

    it("adds trimmed IDs from EXTENSION_IDS and drops malformed ones", () => {
        vi.stubEnv("EXTENSION_IDS", ` ${DEV_ID} , not-an-id,ABCDEFGHIJKLMNOPABCDEFGHIJKLMNOP,qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq,,${STORE_EXTENSION_ID}`);
        expect(knownExtensionIds()).toEqual([STORE_EXTENSION_ID, DEV_ID]);
    });

    it("reads EXTENSION_IDS at call time", () => {
        vi.stubEnv("EXTENSION_IDS", "");
        expect(isKnownExtensionId(DEV_ID)).toBe(false);
        vi.stubEnv("EXTENSION_IDS", DEV_ID);
        expect(isKnownExtensionId(DEV_ID)).toBe(true);
    });
});

describe("isKnownExtensionId", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("accepts the store ID and rejects unknown or missing IDs", () => {
        vi.stubEnv("EXTENSION_IDS", "");
        expect(isKnownExtensionId(STORE_EXTENSION_ID)).toBe(true);
        expect(isKnownExtensionId("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb")).toBe(false);
        expect(isKnownExtensionId("")).toBe(false);
        expect(isKnownExtensionId(null)).toBe(false);
        expect(isKnownExtensionId(undefined)).toBe(false);
    });
});
