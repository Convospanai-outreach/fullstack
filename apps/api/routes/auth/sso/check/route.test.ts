import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        ssoConfiguration: { findFirst: vi.fn() },
    },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

import { GET } from "./route";

describe("GET /auth/sso/check", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns sso:false when no SsoConfiguration allows this domain", async () => {
        mockPrisma.ssoConfiguration.findFirst.mockResolvedValue(null);
        const res = await GET(new Request("http://localhost/auth/sso/check?email=user@nowhere.com"));
        expect(await res.json()).toEqual({ sso: false });
    });

    it("returns an explicit unsupported error for SAML-configured teams instead of a dead redirect", async () => {
        mockPrisma.ssoConfiguration.findFirst.mockResolvedValue({
            teamId: "team-1",
            providerType: "SAML",
        });
        const res = await GET(new Request("http://localhost/auth/sso/check?email=user@enterprise.com"));
        const data = await res.json();
        expect(data.sso).toBe(true);
        expect(data.error).toMatch(/SAML/i);
        expect(data.redirectUrl).toBeUndefined();
    });

    it("returns the teamId for OIDC-configured teams", async () => {
        mockPrisma.ssoConfiguration.findFirst.mockResolvedValue({
            teamId: "team-1",
            providerType: "OIDC",
        });
        const res = await GET(new Request("http://localhost/auth/sso/check?email=user@enterprise.com"));
        expect(await res.json()).toEqual({ sso: true, provider: "OIDC", teamId: "team-1" });
    });
});
