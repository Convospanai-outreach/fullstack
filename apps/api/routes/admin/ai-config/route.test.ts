import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockCheckTeamPermission, mockPrisma, mockAudit } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockCheckTeamPermission: vi.fn(),
    mockPrisma: {
        team: { findUnique: vi.fn(), update: vi.fn() },
    },
    mockAudit: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/permissions", () => ({
    checkTeamPermission: mockCheckTeamPermission,
    TeamRole: { OWNER: "owner", ADMIN: "admin", MEMBER: "member", VIEWER: "viewer" },
}));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/governance/audit", () => ({ audit: mockAudit }));

import { GET, POST } from "./route";

function postRequest(body: any) {
    return new Request("http://localhost/api/admin/ai-config", {
        method: "POST",
        body: JSON.stringify(body),
    }) as any;
}

describe("admin/ai-config route - per-team scoping, not global enterpriseRole (OPEN-228)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("GET", () => {
        it("403s a caller who is only an ADMIN elsewhere, not on THIS team, even with a global ORG_ADMIN enterpriseRole", async () => {
            mockGetCurrentContext.mockResolvedValue({ userId: "attacker", teamId: "team-b" });
            mockCheckTeamPermission.mockResolvedValue(false);

            const res = await GET();

            expect(res.status).toBe(403);
            expect(mockCheckTeamPermission).toHaveBeenCalledWith("attacker", "team-b", "admin");
            expect(mockPrisma.team.findUnique).not.toHaveBeenCalled();
        });

        it("allows a genuine team ADMIN to view their own team's masked config", async () => {
            mockGetCurrentContext.mockResolvedValue({ userId: "owner-1", teamId: "team-a" });
            mockCheckTeamPermission.mockResolvedValue(true);
            mockPrisma.team.findUnique.mockResolvedValue({ aiConfig: { providers: {} } });

            const res = await GET();

            expect(res.status).toBe(200);
        });
    });

    describe("POST", () => {
        it("403s a caller with no admin role on the target team and never mutates the AI config", async () => {
            mockGetCurrentContext.mockResolvedValue({ userId: "attacker", teamId: "team-b" });
            mockCheckTeamPermission.mockResolvedValue(false);

            const res = await POST(postRequest({ geminiApiKey: "attacker-key" }));

            expect(res.status).toBe(403);
            expect(mockPrisma.team.update).not.toHaveBeenCalled();
        });

        it("allows a genuine team ADMIN to update their own team's AI config", async () => {
            mockGetCurrentContext.mockResolvedValue({ userId: "owner-1", teamId: "team-a" });
            mockCheckTeamPermission.mockResolvedValue(true);
            mockPrisma.team.findUnique.mockResolvedValue({ aiConfig: { providers: {} } });
            mockPrisma.team.update.mockResolvedValue({ aiConfig: { providers: { gemini: { apiKey: "new-key" } } } });

            const res = await POST(postRequest({ geminiApiKey: "new-key" }));

            expect(res.status).toBe(200);
            expect(mockPrisma.team.update).toHaveBeenCalledWith(
                expect.objectContaining({ where: { id: "team-a" } })
            );
        });
    });
});
