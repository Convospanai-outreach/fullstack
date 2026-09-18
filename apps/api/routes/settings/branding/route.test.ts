import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockAuth, mockPerms, mockUpdateBranding } = vi.hoisted(() => ({
    mockPrisma: {
        team: { findUnique: vi.fn() },
    },
    mockAuth: { getCurrentContext: vi.fn() },
    mockPerms: {
        checkTeamPermission: vi.fn(),
        TeamRole: { ADMIN: "ADMIN", MEMBER: "MEMBER", VIEWER: "VIEWER" },
    },
    mockUpdateBranding: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ getCurrentContext: mockAuth.getCurrentContext }));
vi.mock("@/lib/permissions", () => ({
    checkTeamPermission: mockPerms.checkTeamPermission,
    TeamRole: mockPerms.TeamRole,
}));
vi.mock("@/modules/branding/brandingService", () => ({
    BrandingService: { updateBranding: mockUpdateBranding },
}));

describe("POST /settings/branding — mandatory email footer", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAuth.getCurrentContext.mockResolvedValue({ userId: "u1", teamId: "team-1" });
        mockPerms.checkTeamPermission.mockResolvedValue(true);
    });

    it("rejects a blank emailFooterText with 400 and does not persist it", async () => {
        const { POST } = await import("./route");
        const req = new Request("http://localhost/settings/branding", {
            method: "POST",
            body: JSON.stringify({ emailFooterText: "   " }),
        });

        const res = await POST(req as any);
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toMatch(/cannot be blank/);
        expect(mockUpdateBranding).not.toHaveBeenCalled();
    });

    it("merges emailFooterText onto the existing branding instead of overwriting it", async () => {
        mockPrisma.team.findUnique.mockResolvedValue({ branding: { logoUrl: "https://example.com/logo.png" } });

        const { POST } = await import("./route");
        const req = new Request("http://localhost/settings/branding", {
            method: "POST",
            body: JSON.stringify({ emailFooterText: "  Talk soon - Priya  " }),
        });

        const res = await POST(req as any);
        expect(res.status).toBe(200);
        expect(mockUpdateBranding).toHaveBeenCalledWith(
            "team-1",
            expect.objectContaining({
                logoUrl: "https://example.com/logo.png",
                emailFooterText: "Talk soon - Priya",
            })
        );
    });
});
