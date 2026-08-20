import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockAuth, mockPerms } = vi.hoisted(() => ({
    mockPrisma: {
        team: {
            findUnique: vi.fn(),
            update: vi.fn(),
        },
    },
    mockAuth: {
        getCurrentContext: vi.fn(),
    },
    mockPerms: {
        checkTeamPermission: vi.fn(),
        TeamRole: { ADMIN: "ADMIN", MEMBER: "MEMBER", VIEWER: "VIEWER" },
    },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ getCurrentContext: mockAuth.getCurrentContext }));
vi.mock("@/lib/permissions", () => ({
    checkTeamPermission: mockPerms.checkTeamPermission,
    TeamRole: mockPerms.TeamRole,
}));

describe("Branding Route Validation (SEC-03)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAuth.getCurrentContext.mockResolvedValue({ userId: "u1", teamId: "team-1" });
        mockPerms.checkTeamPermission.mockResolvedValue(true);
    });

    it("rejects javascript: protocol URLs in logoUrl with 400", async () => {
        const { POST } = await import("../route");
        const req = new Request("http://localhost/api/settings/branding", {
            method: "POST",
            body: JSON.stringify({ logoUrl: "javascript:alert(document.domain)" }),
        });

        const res = await POST(req as any);
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toMatch(/Invalid logoUrl/);
        expect(mockPrisma.team.update).not.toHaveBeenCalled();
    });

    it("rejects data: protocol URLs in faviconUrl with 400", async () => {
        const { POST } = await import("../route");
        const req = new Request("http://localhost/api/settings/branding", {
            method: "POST",
            body: JSON.stringify({ faviconUrl: "data:text/html,<script>alert(1)</script>" }),
        });

        const res = await POST(req as any);
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toMatch(/Invalid faviconUrl/);
    });

    it("rejects invalid color format with 400", async () => {
        const { POST } = await import("../route");
        const req = new Request("http://localhost/api/settings/branding", {
            method: "POST",
            body: JSON.stringify({ primaryColor: "not-a-color-payload" }),
        });

        const res = await POST(req as any);
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toMatch(/Invalid primaryColor/);
    });

    it("accepts valid https URL and valid hex color", async () => {
        mockPrisma.team.findUnique.mockResolvedValue({ branding: {} });
        mockPrisma.team.update.mockResolvedValue({ id: "team-1" });

        const { POST } = await import("../route");
        const req = new Request("http://localhost/api/settings/branding", {
            method: "POST",
            body: JSON.stringify({
                logoUrl: "https://example.com/logo.png",
                primaryColor: "#4f46e5",
                portalTitle: "Acme Portal <script>",
            }),
        });

        const res = await POST(req as any);
        expect(res.status).toBe(200);
        expect(mockPrisma.team.update).toHaveBeenCalledWith({
            where: { id: "team-1" },
            data: {
                branding: {
                    logoUrl: "https://example.com/logo.png",
                    primaryColor: "#4f46e5",
                    portalTitle: "Acme Portal script",
                },
            },
        });
    });
});
