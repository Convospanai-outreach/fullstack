import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockPrisma, mockCheckTeamPermission, mockAudit, mockEncryptCrmToken } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockPrisma: {
        crmIntegration: { findMany: vi.fn(), upsert: vi.fn() },
    },
    mockCheckTeamPermission: vi.fn(),
    mockAudit: vi.fn(),
    mockEncryptCrmToken: vi.fn((v: string) => `encrypted(${v})`),
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/governance/audit", () => ({ audit: mockAudit }));
vi.mock("@/lib/permissions", () => ({
    checkTeamPermission: mockCheckTeamPermission,
    TeamRole: { ADMIN: "ADMIN" },
}));
vi.mock("@/modules/crm-integration/service/crmSecrets", () => ({ encryptCrmToken: mockEncryptCrmToken }));

import { GET, PUT } from "./route";

describe("settings/crm route - token handling", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockCheckTeamPermission.mockResolvedValue(true);
        mockAudit.mockResolvedValue(undefined);
    });

    it("GET never returns the raw access or refresh token", async () => {
        mockPrisma.crmIntegration.findMany.mockResolvedValue([
            { id: "crm-1", provider: "HUBSPOT", accessToken: "encrypted(real-token)", refreshToken: "encrypted(real-refresh)", isActive: true },
        ]);

        const res = await GET();
        const data = await res.json();
        expect(JSON.stringify(data)).not.toContain("real-token");
        expect(JSON.stringify(data)).not.toContain("real-refresh");
        expect(data[0].hasAccessToken).toBe(true);
        expect(data[0].hasRefreshToken).toBe(true);
        expect(data[0].accessToken).toBeUndefined();
    });

    it("PUT encrypts a newly submitted access token before storing it", async () => {
        mockPrisma.crmIntegration.upsert.mockResolvedValue({ id: "crm-1", accessToken: "encrypted(new-token)" });

        await PUT(
            new Request("http://localhost", {
                method: "PUT",
                body: JSON.stringify({ provider: "HUBSPOT", accessToken: "new-token", isActive: true }),
            })
        );

        expect(mockEncryptCrmToken).toHaveBeenCalledWith("new-token");
        const upsertArgs = mockPrisma.crmIntegration.upsert.mock.calls[0][0];
        expect(upsertArgs.update.accessToken).toBe("encrypted(new-token)");
        expect(upsertArgs.create.accessToken).toBe("encrypted(new-token)");
    });

    it("PUT rejects an unsupported provider before touching any token", async () => {
        const res = await PUT(
            new Request("http://localhost", {
                method: "PUT",
                body: JSON.stringify({ provider: "SALESFORCE", accessToken: "new-token" }),
            })
        );

        expect(res.status).toBe(400);
        expect(mockEncryptCrmToken).not.toHaveBeenCalled();
        expect(mockPrisma.crmIntegration.upsert).not.toHaveBeenCalled();
    });
});
