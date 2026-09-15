import { vi, Mock } from "vitest";

const { mockPrisma, mockIsSsoEnforcedForEmail, mockSyncGoogleUserToApp, mockCookies } = vi.hoisted(() => ({
    mockPrisma: {
        user: { findUnique: vi.fn() },
    },
    mockIsSsoEnforcedForEmail: vi.fn(),
    mockSyncGoogleUserToApp: vi.fn(),
    mockCookies: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/sso/oidc", () => ({ isSsoEnforcedForEmail: mockIsSsoEnforcedForEmail }));
vi.mock("@/lib/googleOnboarding", () => ({ syncGoogleUserToApp: mockSyncGoogleUserToApp }));
vi.mock("next/headers", () => ({ cookies: mockCookies }));
vi.mock("next-auth/providers/google", () => ({ default: vi.fn(() => ({ id: "google" })) }));
vi.mock("@next-auth/prisma-adapter", () => ({ PrismaAdapter: vi.fn(() => ({})) }));

import { authOptions } from "../auth";

describe("authOptions.callbacks.signIn - Google branch", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCookies.mockResolvedValue({ get: vi.fn().mockReturnValue(undefined) });
    });

    const signIn = authOptions.callbacks!.signIn! as (params: any) => Promise<boolean | string>;
    const account = { provider: "google" };
    const verifiedProfile = { email_verified: true, name: "Ada Lovelace" };

    it("denies when the email is unverified by Google", async () => {
        const result = await signIn({ user: { email: "a@b.com" }, account, profile: { email_verified: false } });
        expect(result).toBe(false);
        expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    it("denies an existing user whose domain now has SSO enforced", async () => {
        mockPrisma.user.findUnique.mockResolvedValue({ id: "user-1" });
        mockIsSsoEnforcedForEmail.mockResolvedValue(true);

        const result = await signIn({ user: { email: "user@enterprise.com" }, account, profile: verifiedProfile });

        expect(result).toBe("/login?error=sso-required");
    });

    it("attaches the existing user's id and allows sign-in when no SSO enforcement applies", async () => {
        mockPrisma.user.findUnique.mockResolvedValue({ id: "user-1" });
        mockIsSsoEnforcedForEmail.mockResolvedValue(false);
        const user: { email: string; id?: string } = { email: "user@example.com" };

        const result = await signIn({ user, account, profile: verifiedProfile });

        expect(result).toBe(true);
        expect(user.id).toBe("user-1");
        expect(mockSyncGoogleUserToApp).not.toHaveBeenCalled();
    });

    it("creates a new user via syncGoogleUserToApp and attaches the id (signup is open, invite optional)", async () => {
        mockPrisma.user.findUnique.mockResolvedValue(null);
        mockCookies.mockResolvedValue({ get: vi.fn().mockReturnValue({ value: "invite-token-123" }) });
        mockSyncGoogleUserToApp.mockResolvedValue({ id: "new-user-1" });
        const user: { email: string; id?: string } = { email: "new@example.com" };

        const result = await signIn({ user, account, profile: verifiedProfile });

        expect(mockSyncGoogleUserToApp).toHaveBeenCalledWith({
            email: "new@example.com",
            name: "Ada Lovelace",
            inviteToken: "invite-token-123",
            hostedDomain: undefined,
        });
        expect(result).toBe(true);
        expect(user.id).toBe("new-user-1");
    });

    it("passes Google's hd claim through as hostedDomain for a Workspace login", async () => {
        mockPrisma.user.findUnique.mockResolvedValue(null);
        mockSyncGoogleUserToApp.mockResolvedValue({ id: "new-user-2" });
        const user: { email: string; id?: string } = { email: "newhire@smcindia.com" };

        await signIn({ user, account, profile: { ...verifiedProfile, hd: "smcindia.com" } });

        expect(mockSyncGoogleUserToApp).toHaveBeenCalledWith(
            expect.objectContaining({ hostedDomain: "smcindia.com" })
        );
    });

    it("denies a new user only when syncGoogleUserToApp returns null (SSO enforced on their domain)", async () => {
        mockPrisma.user.findUnique.mockResolvedValue(null);
        mockSyncGoogleUserToApp.mockResolvedValue(null);

        const result = await signIn({ user: { email: "enterprise@example.com" }, account, profile: verifiedProfile });

        expect(result).toBe("/login?error=sso-required");
    });
});
