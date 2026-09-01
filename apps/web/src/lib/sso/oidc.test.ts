import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        ssoConfiguration: { findUnique: vi.fn() },
        user: { findUnique: vi.fn() },
        teamMember: { findFirst: vi.fn() },
    },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

import { resolveOidcSsoForTeam, isOidcSignInAllowed } from "./oidc";

describe("resolveOidcSsoForTeam", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns null when no SsoConfiguration exists for the team", async () => {
        mockPrisma.ssoConfiguration.findUnique.mockResolvedValue(null);
        expect(await resolveOidcSsoForTeam("team-1")).toBeNull();
    });

    it("returns null for a SAML-configured team", async () => {
        mockPrisma.ssoConfiguration.findUnique.mockResolvedValue({
            teamId: "team-1",
            providerType: "SAML",
            allowedDomains: [],
        });
        expect(await resolveOidcSsoForTeam("team-1")).toBeNull();
    });

    it("returns null when OIDC fields are incomplete", async () => {
        mockPrisma.ssoConfiguration.findUnique.mockResolvedValue({
            teamId: "team-1",
            providerType: "OIDC",
            clientId: "abc",
            clientSecret: null,
            wellKnownUrl: "https://idp.example.com/.well-known/openid-configuration",
            allowedDomains: [],
        });
        expect(await resolveOidcSsoForTeam("team-1")).toBeNull();
    });

    it("resolves a real OIDC provider config, lowercasing allowed domains", async () => {
        mockPrisma.ssoConfiguration.findUnique.mockResolvedValue({
            teamId: "team-1",
            providerType: "OIDC",
            clientId: "abc",
            clientSecret: "secret",
            wellKnownUrl: "https://idp.example.com/.well-known/openid-configuration",
            allowedDomains: ["Enterprise.com"],
        });

        const resolved = await resolveOidcSsoForTeam("team-1");
        expect(resolved?.teamId).toBe("team-1");
        expect(resolved?.allowedDomains).toEqual(["enterprise.com"]);
        expect(resolved?.provider.id).toBe("oidc");
        expect(resolved?.provider.allowDangerousEmailAccountLinking).toBe(true);
    });
});

describe("isOidcSignInAllowed", () => {
    beforeEach(() => vi.clearAllMocks());

    const base = { allowedDomains: ["enterprise.com"], teamId: "team-1" };

    it("rejects when the IdP does not assert email_verified", async () => {
        const allowed = await isOidcSignInAllowed({
            profile: { email_verified: false },
            email: "user@enterprise.com",
            ...base,
        });
        expect(allowed).toBe(false);
        expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    it("rejects when the email domain is not in allowedDomains", async () => {
        const allowed = await isOidcSignInAllowed({
            profile: { email_verified: true },
            email: "user@other.com",
            ...base,
        });
        expect(allowed).toBe(false);
        expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    it("rejects when no existing user has that email (no auto-provisioning)", async () => {
        mockPrisma.user.findUnique.mockResolvedValue(null);
        const allowed = await isOidcSignInAllowed({
            profile: { email_verified: true },
            email: "user@enterprise.com",
            ...base,
        });
        expect(allowed).toBe(false);
        expect(mockPrisma.teamMember.findFirst).not.toHaveBeenCalled();
    });

    it("rejects when the existing user is not an active member of this team", async () => {
        mockPrisma.user.findUnique.mockResolvedValue({ id: "user-1" });
        mockPrisma.teamMember.findFirst.mockResolvedValue(null);
        const allowed = await isOidcSignInAllowed({
            profile: { email_verified: true },
            email: "user@enterprise.com",
            ...base,
        });
        expect(allowed).toBe(false);
    });

    it("allows sign-in when verified, domain-matched, and an active team member", async () => {
        mockPrisma.user.findUnique.mockResolvedValue({ id: "user-1" });
        mockPrisma.teamMember.findFirst.mockResolvedValue({ id: "membership-1" });
        const allowed = await isOidcSignInAllowed({
            profile: { email_verified: true },
            email: "User@Enterprise.com",
            ...base,
        });
        expect(allowed).toBe(true);
        expect(mockPrisma.teamMember.findFirst).toHaveBeenCalledWith({
            where: { teamId: "team-1", userId: "user-1", status: "active" },
            select: { id: true },
        });
    });
});
