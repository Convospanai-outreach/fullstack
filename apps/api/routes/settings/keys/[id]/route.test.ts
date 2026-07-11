import { beforeEach, describe, expect, it, vi } from "vitest";

const {
    mockAudit,
    mockCheckTeamPermission,
    mockGetCurrentContext,
    mockPrisma,
} = vi.hoisted(() => ({
    mockAudit: vi.fn(),
    mockCheckTeamPermission: vi.fn(),
    mockGetCurrentContext: vi.fn(),
    mockPrisma: {
        apiKey: {
            updateMany: vi.fn(),
        },
    },
}));

vi.mock("@/lib/auth", () => ({
    getCurrentContext: mockGetCurrentContext,
}));

vi.mock("@/lib/db", () => ({
    prisma: mockPrisma,
}));

vi.mock("@/lib/permissions", () => ({
    TeamRole: { ADMIN: "admin" },
    checkTeamPermission: mockCheckTeamPermission,
}));

vi.mock("@/lib/governance/audit", () => ({
    audit: mockAudit,
}));

describe("/settings/keys/[id]", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockCheckTeamPermission.mockResolvedValue(true);
        mockAudit.mockResolvedValue(undefined);
        mockPrisma.apiKey.updateMany.mockResolvedValue({ count: 1 });
    });

    it("revokes active keys without deleting the record", async () => {
        const { DELETE } = await import("./route");

        const response = await DELETE(new Request("http://localhost/settings/keys/key-1", {
            method: "DELETE",
        }) as any, { params: Promise.resolve({ id: "key-1" }) });

        expect(response.status).toBe(200);
        expect(mockPrisma.apiKey.updateMany).toHaveBeenCalledWith({
            where: { id: "key-1", teamId: "team-1", isActive: true },
            data: { isActive: false },
        });
        expect(mockAudit).toHaveBeenCalledWith(expect.objectContaining({
            action: "API_KEY_REVOKED",
            entityId: "key-1",
            metadata: {},
        }));
    });

    it("returns 404 when no active team-scoped key is revoked", async () => {
        mockPrisma.apiKey.updateMany.mockResolvedValue({ count: 0 });
        const { DELETE } = await import("./route");

        const response = await DELETE(new Request("http://localhost/settings/keys/key-2", {
            method: "DELETE",
        }) as any, { params: Promise.resolve({ id: "key-2" }) });

        expect(response.status).toBe(404);
        expect(mockAudit).not.toHaveBeenCalled();
    });
});
