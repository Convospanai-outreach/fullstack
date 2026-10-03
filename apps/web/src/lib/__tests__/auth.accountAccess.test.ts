import { vi } from "vitest";

const { mockPrisma, mockCookies } = vi.hoisted(() => ({
    mockPrisma: { user: { findUnique: vi.fn() } },
    mockCookies: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/sso/oidc", () => ({ isSsoEnforcedForEmail: vi.fn().mockResolvedValue(false) }));
vi.mock("@/lib/googleOnboarding", () => ({ syncGoogleUserToApp: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: mockCookies }));
vi.mock("next-auth/providers/google", () => ({ default: vi.fn(() => ({ id: "google" })) }));
vi.mock("@next-auth/prisma-adapter", () => ({ PrismaAdapter: vi.fn(() => ({})) }));

import { authOptions } from "../auth";

const signIn = authOptions.callbacks!.signIn! as unknown as (params: any) => Promise<boolean | string>;
const jwt = authOptions.callbacks!.jwt! as unknown as (params: any) => Promise<Record<string, unknown>>;

// Claims fresh enough that the callback skips its plan/role refresh.
const freshToken = (id: string, extra: Record<string, unknown> = {}) => ({
    id,
    email: `${id}@example.com`,
    claimsRefreshedAt: Date.now(),
    plan: "FREE",
    productMode: "ENTERPRISE_CORE",
    productSurface: "outreach",
    enterpriseRole: "SALES_USER",
    ...extra,
});

// Each test uses its own user id: lib/userAccess caches per user for 30 seconds.
describe("account access in the NextAuth callbacks", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCookies.mockResolvedValue({ get: vi.fn().mockReturnValue(undefined) });
    });

    it("refuses sign-in for a suspended account", async () => {
        mockPrisma.user.findUnique.mockResolvedValue({ id: "u-suspended-signin", suspendedAt: new Date() });
        const result = await signIn({ user: { email: "u@example.com" }, account: { provider: "google" }, profile: { email_verified: true } });
        expect(result).toBe("/login?error=suspended");
    });

    it("stamps the current session version on sign-in", async () => {
        mockPrisma.user.findUnique.mockResolvedValue({ suspendedAt: null, sessionVersion: 3 });
        const token = await jwt({ token: freshToken("u-signin"), user: { id: "u-signin" } });
        expect(token["sessionVersion"]).toBe(3);
        expect(token["id"]).toBe("u-signin");
    });

    it("keeps a session whose version matches, counting a missing version as 0", async () => {
        mockPrisma.user.findUnique.mockResolvedValue({ suspendedAt: null, sessionVersion: 0 });
        const token = await jwt({ token: freshToken("u-ok") });
        expect(token["id"]).toBe("u-ok");
    });

    it("ends the session of a suspended account", async () => {
        mockPrisma.user.findUnique.mockResolvedValue({ suspendedAt: new Date(), sessionVersion: 1 });
        expect(await jwt({ token: freshToken("u-suspended", { sessionVersion: 1 }) })).toEqual({});
    });

    it("ends a session signed out from the superadmin panel", async () => {
        mockPrisma.user.findUnique.mockResolvedValue({ suspendedAt: null, sessionVersion: 2 });
        expect(await jwt({ token: freshToken("u-signed-out", { sessionVersion: 1 }) })).toEqual({});
    });

    it("ends the session of a deleted user", async () => {
        mockPrisma.user.findUnique.mockResolvedValue(null);
        expect(await jwt({ token: freshToken("u-deleted") })).toEqual({});
    });

    it("keeps the session when the access check itself fails", async () => {
        mockPrisma.user.findUnique.mockRejectedValue(new Error("db down"));
        const token = await jwt({ token: freshToken("u-db-error") });
        expect(token["id"]).toBe("u-db-error");
    });
});
