import { createHash } from "crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/sso/oidc", () => ({ isSsoEnforcedForEmail: vi.fn() }));
vi.mock("@/lib/passwordOnboarding", () => ({ provisionUserTeam: vi.fn() }));
vi.mock("@/lib/botCheck", () => ({ allowForEmail: vi.fn() }));

import { loginLogId } from "../passwordAuth";

describe("loginLogId", () => {
    afterEach(() => vi.unstubAllEnvs());

    it("is not the plain hash of the email, so it cannot be recomputed without the secret", () => {
        vi.stubEnv("NEXTAUTH_SECRET", "test-secret");
        const plain = createHash("sha256").update("a@example.com").digest("hex").slice(0, 12);
        const id = loginLogId("a@example.com");
        expect(id).toMatch(/^[0-9a-f]{12}$/);
        expect(id).not.toBe(plain);
    });

    it("is stable per email and differs across secrets", () => {
        vi.stubEnv("NEXTAUTH_SECRET", "secret-one");
        const first = loginLogId("a@example.com");
        expect(loginLogId("a@example.com")).toBe(first);
        vi.stubEnv("NEXTAUTH_SECRET", "secret-two");
        expect(loginLogId("a@example.com")).not.toBe(first);
    });

    it("logs no id when no secret is configured", () => {
        vi.stubEnv("NEXTAUTH_SECRET", "");
        expect(loginLogId("a@example.com")).toBeUndefined();
    });
});
