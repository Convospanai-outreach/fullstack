import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockPrisma, mockAuthorizePermission, mockWriteAuditLog, mockDispatchAuditWebhook, mockEncryptClientSecret } = vi.hoisted(() => {
    // The route reaches Prisma through the transaction client for anything that is audited.
    const ssoConfiguration = { findUnique: vi.fn(), upsert: vi.fn(), delete: vi.fn() };
    const tx = { ssoConfiguration };
    return {
        mockGetCurrentContext: vi.fn(),
        mockPrisma: {
            ssoConfiguration,
            $transaction: vi.fn(async (fn: (client: unknown) => unknown) => fn(tx)),
            tx,
        },
        mockAuthorizePermission: vi.fn(),
        mockWriteAuditLog: vi.fn(),
        mockDispatchAuditWebhook: vi.fn(),
        mockEncryptClientSecret: vi.fn((v: string) => `encrypted(${v})`),
    };
});

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/governance/audit", () => ({ writeAuditLog: mockWriteAuditLog, dispatchAuditWebhook: mockDispatchAuditWebhook }));
vi.mock("@/lib/permissions", () => ({
    Permission: { MANAGE_SSO: "MANAGE_SSO" },
    authorizePermission: mockAuthorizePermission,
}));
vi.mock("@/modules/settings/ssoSecrets", () => ({ encryptClientSecret: mockEncryptClientSecret }));

import { DELETE, GET, PUT } from "./route";

describe("settings/sso route - client secret handling", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockAuthorizePermission.mockResolvedValue(undefined);
        mockWriteAuditLog.mockResolvedValue({ id: "log-1", createdAt: new Date() });
        mockDispatchAuditWebhook.mockResolvedValue(undefined);
        mockPrisma.$transaction.mockImplementation(async (fn: (client: unknown) => unknown) => fn(mockPrisma.tx));
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

    it("PUT writes the audit row on the same transaction client as the configuration change", async () => {
        mockPrisma.ssoConfiguration.upsert.mockResolvedValue({ id: "sso-1", clientSecret: "" });

        const res = await PUT(
            new Request("http://localhost", { method: "PUT", body: JSON.stringify({ providerType: "OIDC", allowedDomains: [] }) })
        );

        expect(res.status).toBe(200);
        expect(mockWriteAuditLog).toHaveBeenCalledWith(mockPrisma.tx, expect.objectContaining({ action: "UPDATE_SSO_CONFIG", entityId: "sso-1" }));
        expect(mockDispatchAuditWebhook).toHaveBeenCalledTimes(1);
    });

    it("PUT fails, and announces nothing, when the audit row cannot be written", async () => {
        mockPrisma.ssoConfiguration.upsert.mockResolvedValue({ id: "sso-1", clientSecret: "" });
        mockWriteAuditLog.mockRejectedValue(new Error("audit table unavailable"));

        const res = await PUT(
            new Request("http://localhost", { method: "PUT", body: JSON.stringify({ providerType: "OIDC", allowedDomains: [] }) })
        );

        expect(res.status).toBe(500);
        expect(mockDispatchAuditWebhook).not.toHaveBeenCalled();
    });

    it("DELETE removes the configuration and writes its audit row on one transaction client", async () => {
        mockPrisma.ssoConfiguration.delete.mockResolvedValue({});

        const res = await DELETE();

        expect(res.status).toBe(200);
        expect(mockWriteAuditLog).toHaveBeenCalledWith(mockPrisma.tx, expect.objectContaining({ action: "DELETE_SSO_CONFIG" }));
    });

    it("DELETE fails, and announces nothing, when the audit row cannot be written", async () => {
        mockPrisma.ssoConfiguration.delete.mockResolvedValue({});
        mockWriteAuditLog.mockRejectedValue(new Error("audit table unavailable"));

        const res = await DELETE();

        expect(res.status).toBe(500);
        expect(mockDispatchAuditWebhook).not.toHaveBeenCalled();
    });
});
