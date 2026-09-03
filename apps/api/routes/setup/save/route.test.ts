import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCheckTeamPermission, mockGetCurrentContextFromRequest, mockPrisma } = vi.hoisted(() => ({
    mockCheckTeamPermission: vi.fn(),
    mockGetCurrentContextFromRequest: vi.fn(),
    mockPrisma: {
        team: {
            findUnique: vi.fn(),
            update: vi.fn(),
        },
    },
}));

vi.mock("@/lib/auth", () => ({
    getCurrentContextFromRequest: mockGetCurrentContextFromRequest,
}));

vi.mock("@/lib/db", () => ({
    prisma: mockPrisma,
}));

vi.mock("@/lib/permissions", () => ({
    TeamRole: { ADMIN: "admin", MEMBER: "member" },
    checkTeamPermission: mockCheckTeamPermission,
}));

function postRequest(body: unknown) {
    return new Request("http://localhost/setup/save", {
        method: "POST",
        body: JSON.stringify(body),
    }) as any;
}

describe("/setup/save", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContextFromRequest.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockPrisma.team.findUnique.mockResolvedValue({ branding: {}, aiConfig: {} });
        mockPrisma.team.update.mockResolvedValue({});
    });

    it("lets a plain team member (not admin/owner) save a setup step", async () => {
        // An invited teammate who isn't ORG_ADMIN lands on team role "member" (see
        // clerkAuth.ts) - this must not 403 them out of the setup wizard's Save button.
        mockCheckTeamPermission.mockImplementation(async (_userId, _teamId, role) => role === "member");
        const { POST } = await import("./route");

        const response = await POST(postRequest({ step: 2, data: { companyName: "Acme" } }));

        expect(response.status).toBe(200);
        expect(mockCheckTeamPermission).toHaveBeenCalledWith("user-1", "team-1", "member");
        expect(mockPrisma.team.update).toHaveBeenCalled();
    });

    it("still blocks a user with no team membership at all", async () => {
        mockCheckTeamPermission.mockResolvedValue(false);
        const { POST } = await import("./route");

        const response = await POST(postRequest({ step: 2, data: { companyName: "Acme" } }));

        expect(response.status).toBe(403);
        expect(mockPrisma.team.update).not.toHaveBeenCalled();
    });
});
