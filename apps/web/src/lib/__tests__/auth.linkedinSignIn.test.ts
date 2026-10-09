import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockLinkedInSignIn, mockLinkAccount, mockSyncGoogleUserToApp } = vi.hoisted(() => ({
    mockPrisma: { user: { findUnique: vi.fn(), update: vi.fn() } },
    mockLinkedInSignIn: vi.fn(),
    mockLinkAccount: vi.fn(),
    mockSyncGoogleUserToApp: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/sso/oidc", () => ({ isSsoEnforcedForEmail: vi.fn().mockResolvedValue(false) }));
vi.mock("@/lib/googleOnboarding", () => ({ syncGoogleUserToApp: mockSyncGoogleUserToApp }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("next-auth/providers/google", () => ({ default: vi.fn(() => ({ id: "google" })) }));
vi.mock("@next-auth/prisma-adapter", () => ({ PrismaAdapter: vi.fn(() => ({ linkAccount: mockLinkAccount })) }));
vi.mock("@/lib/linkedinLogin", () => ({
    linkedInLoginProvider: vi.fn(() => ({ id: "linkedin" })),
    linkedInSignIn: mockLinkedInSignIn,
}));

import { authOptions } from "../auth";

const signIn = authOptions.callbacks!.signIn! as unknown as (params: any) => Promise<boolean | string>;

describe("authOptions with LinkedIn sign-in switched on", () => {
    beforeEach(() => vi.clearAllMocks());

    it("registers the LinkedIn provider next to Google and password", () => {
        expect(authOptions.providers.map((provider) => provider.id)).toEqual(["credentials", "google", "linkedin"]);
    });

    it("leaves the whole decision to linkedInSignIn and never applies the Google email rules", async () => {
        const profile = { sub: "li-sub", email: "owner@company.com", email_verified: true };
        mockLinkedInSignIn.mockResolvedValue("/login?error=linkedin-not-connected&callbackUrl=%2Fsettings%2Fgeneral");
        const user: { email: string; id?: string } = { email: "owner@company.com" };

        const result = await signIn({ user, account: { provider: "linkedin", providerAccountId: "li-sub" }, profile });

        expect(result).toBe("/login?error=linkedin-not-connected&callbackUrl=%2Fsettings%2Fgeneral");
        expect(mockLinkedInSignIn).toHaveBeenCalledWith("li-sub", profile);
        expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
        expect(mockPrisma.user.update).not.toHaveBeenCalled();
        expect(mockSyncGoogleUserToApp).not.toHaveBeenCalled();
        expect(user.id).toBeUndefined();
    });

    it("saves a LinkedIn connection without any LinkedIn token", async () => {
        await authOptions.adapter!.linkAccount!({
            userId: "user-1",
            type: "oauth",
            provider: "linkedin",
            providerAccountId: "li-sub",
            access_token: "at",
            expires_at: 123,
            scope: "openid profile email",
        } as any);

        expect(mockLinkAccount).toHaveBeenCalledWith({ userId: "user-1", type: "oauth", provider: "linkedin", providerAccountId: "li-sub" });
    });

    it("saves a Google connection exactly as before", async () => {
        const account = { userId: "user-1", type: "oauth", provider: "google", providerAccountId: "g-1", access_token: "at", id_token: "jwt" };

        await authOptions.adapter!.linkAccount!(account as any);

        expect(mockLinkAccount).toHaveBeenCalledWith(account);
    });
});
