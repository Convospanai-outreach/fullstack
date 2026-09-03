import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockPrisma, mockAuthorizePermission, mockAudit, mockEncryptClientSecret } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockPrisma: {
        ssoConfiguration: { findUnique: vi.fn(), upsert: vi.fn(), delete: vi.fn() },
    },
    mockAuthorizePermission: vi.fn(),
    mockAudit: vi.fn(),
    mockEncryptClientSecret: vi.fn((v: string) => `encrypted(${v})`),
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/governance/audit", () => ({ audit: mockAudit }));
vi.mock("@/lib/permissions", () => ({
    Permission: { MANAGE_SSO: "MANAGE_SSO" },
    authorizePermission: mockAuthorizePermission,
}));
vi.mock("@/modules/settings/ssoSecrets", () => ({ encryptClientSecret: mockEncryptClientSecret }));

import { GET, PUT } from "./route";

describe("settings/sso route - client secret handling", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockAuthorizePermission.mockResolvedValue(undefined);
        mockAudit.mockResolvedValue(undefined);
    });

    it("GET redacts a stored client secret instead of returning it", async () => {
        mockPrisma.ssoConfiguration.findUnique.mockResolvedValue({
            id: "sso-1",
            teamId: "team-1",
            providerType: "OIDC",
            clientSecret: "encrypted(real-secret)",
        });

        const res = await GET();
        const data = await res.json();
        expect(data.clientSecret).toBe("••••••••");
        expect(JSON.stringify(data)).not.toContain("real-secret");
    });

    it("GET returns an empty string when no secret is stored", async () => {
        mockPrisma.ssoConfiguration.findUnique.mockResolvedValue({
            id: "sso-1",
            teamId: "team-1",
            providerType: "OIDC",
            clientSecret: null,
        });

        const res = await GET();
        expect((await res.json()).clientSecret).toBe("");
    });

    it("PUT leaves the stored secret unchanged when the redacted placeholder is submitted back", async () => {
        mockPrisma.ssoConfiguration.upsert.mockResolvedValue({ id: "sso-1", clientSecret: "encrypted(real-secret)" });

        await PUT(
            new Request("http://localhost", {
                method: "PUT",
                body: JSON.stringify({ providerType: "OIDC", clientSecret: "••••••••", allowedDomains: [] }),
            })
        );

        expect(mockEncryptClientSecret).not.toHaveBeenCalled();
        const upsertArgs = mockPrisma.ssoConfiguration.upsert.mock.calls[0][0];
        expect(upsertArgs.update).not.toHaveProperty("clientSecret");
    });

    it("PUT leaves the stored secret unchanged when clientSecret is omitted", async () => {
        mockPrisma.ssoConfiguration.upsert.mockResolvedValue({ id: "sso-1", clientSecret: "encrypted(real-secret)" });

        await PUT(
            new Request("http://localhost", {
                method: "PUT",
                body: JSON.stringify({ providerType: "OIDC", allowedDomains: [] }),
            })
        );

        expect(mockEncryptClientSecret).not.toHaveBeenCalled();
    });

    it("PUT encrypts and stores a genuinely new secret", async () => {
        mockPrisma.ssoConfiguration.upsert.mockResolvedValue({ id: "sso-1", clientSecret: "encrypted(new-secret)" });

        await PUT(
            new Request("http://localhost", {
                method: "PUT",
                body: JSON.stringify({ providerType: "OIDC", clientSecret: "new-secret", allowedDomains: [] }),
            })
        );

        expect(mockEncryptClientSecret).toHaveBeenCalledWith("new-secret");
        const upsertArgs = mockPrisma.ssoConfiguration.upsert.mock.calls[0][0];
        expect(upsertArgs.update.clientSecret).toBe("encrypted(new-secret)");
    });
});
