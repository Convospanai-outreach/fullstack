import { describe, expect, it } from "vitest";
import { assertProductionSecretsAreSafe } from "@/lib/bootSecretAssertions";

const SAFE_ENV: NodeJS.ProcessEnv = {
    NODE_ENV: "production",
    ENCRYPTION_KEY: "7f3a9c1e2b4d6f80112233445566778899aabbccddeeff0012233445566778a",
    NEXTAUTH_SECRET: "a-real-generated-secret",
    CRON_SECRET: "a-real-generated-cron-secret",
    BLIND_INDEX_KEY: "a-real-generated-blind-index-key",
};

describe("assertProductionSecretsAreSafe", () => {
    it("does not throw outside production", () => {
        expect(() =>
            assertProductionSecretsAreSafe({ ...SAFE_ENV, NODE_ENV: "test", ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" })
        ).not.toThrow();
    });

    it("does not throw in production when all secrets are real", () => {
        expect(() => assertProductionSecretsAreSafe(SAFE_ENV)).not.toThrow();
    });

    it("throws when ENCRYPTION_KEY is the sample value", () => {
        expect(() =>
            assertProductionSecretsAreSafe({
                ...SAFE_ENV,
                ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
            })
        ).toThrow(/ENCRYPTION_KEY/);
    });

    it("throws when NEXTAUTH_SECRET is the sample value", () => {
        expect(() =>
            assertProductionSecretsAreSafe({ ...SAFE_ENV, NEXTAUTH_SECRET: "your-secret-key-here" })
        ).toThrow(/NEXTAUTH_SECRET/);
    });

    it("throws when CRON_SECRET is the change-me default", () => {
        expect(() =>
            assertProductionSecretsAreSafe({ ...SAFE_ENV, CRON_SECRET: "change-me" })
        ).toThrow(/CRON_SECRET/);
    });

    it("throws when neither BLIND_INDEX_KEY nor ENCRYPTION_KEY is set", () => {
        const env = { ...SAFE_ENV };
        delete env.BLIND_INDEX_KEY;
        delete env.ENCRYPTION_KEY;
        expect(() => assertProductionSecretsAreSafe(env)).toThrow(/BLIND_INDEX_KEY/);
    });

    it("does not throw when BLIND_INDEX_KEY is unset but a real ENCRYPTION_KEY fallback exists", () => {
        const env = { ...SAFE_ENV };
        delete env.BLIND_INDEX_KEY;
        expect(() => assertProductionSecretsAreSafe(env)).not.toThrow();
    });
});
