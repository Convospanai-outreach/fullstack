import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/sso/oidc", () => ({ isSsoEnforcedForEmail: vi.fn() }));
vi.mock("@/lib/googleOnboarding", () => ({ syncGoogleUserToApp: vi.fn() }));
vi.mock("@/lib/passwordOnboarding", () => ({ provisionUserTeam: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("next-auth/providers/google", () => ({ default: vi.fn(() => ({ id: "google" })) }));
vi.mock("@next-auth/prisma-adapter", () => ({ PrismaAdapter: vi.fn(() => ({})) }));

import { authOptions } from "../auth";

describe("authOptions.session", () => {
    it("expires the signed-in session after 24 hours", () => {
        expect(authOptions.session?.strategy).toBe("jwt");
        expect(authOptions.session?.maxAge).toBe(24 * 60 * 60);
    });
});
