import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFindOrCreateClerkAppUser, mockPrisma, mockAudit } = vi.hoisted(() => ({
    mockFindOrCreateClerkAppUser: vi.fn(),
    mockAudit: vi.fn(),
    mockPrisma: {
        inviteRequest: { findUnique: vi.fn(), update: vi.fn() },
        team: { create: vi.fn() },
        userInvitation: { create: vi.fn() },
        teamMember: { create: vi.fn(), findFirst: vi.fn() },
        $transaction: vi.fn(),
    },
}));

vi.mock("next-auth", () => ({ getServerSession: vi.fn().mockResolvedValue(null) }));
vi.mock("@clerk/nextjs/server", () => ({ clerkClient: vi.fn() }));
vi.mock("@/lib/auth", () => ({
    authOptions: {},
    canInviteUsers: () => true,
    isSuperAdminRole: () => true,
}));
vi.mock("@/lib/clerkAuth", () => ({ findOrCreateClerkAppUser: mockFindOrCreateClerkAppUser }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/modules/audit/auditService", () => ({ AuditService: { log: mockAudit } }));
vi.mock("@/lib/invitations", () => ({
    createInviteToken: () => "raw-token",
    getInviteLink: (token: string) => `https://app.example.com/signup?token=${token}`,
    getAppBaseUrl: () => "https://app.example.com",
    hashInviteToken: (token: string) => `hashed-${token}`,
    INVITE_TTL_MS: 7 * 24 * 60 * 60 * 1000,
    isAssignableInviteRole: () => true,
    maybeSendInviteEmail: vi.fn().mockResolvedValue(false),
}));

function patchRequest(body: unknown) {
    return new Request("http://localhost/api/admin/invites", {
        method: "PATCH",
        body: JSON.stringify(body),
    }) as any;
}

describe("PATCH /api/admin/invites - approve-request", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFindOrCreateClerkAppUser.mockResolvedValue({
            id: "admin-1",
            enterpriseRole: "SUPER_ADMIN",
            memberships: [{ teamId: "admins-existing-team", status: "active" }],
        });
        mockPrisma.inviteRequest.findUnique.mockResolvedValue({
            id: "req-1",
            email: "founder@example.com",
            company: "Acme",
            status: "WAITLISTED",
        });
        mockPrisma.$transaction.mockImplementation((cb: any) => cb(mockPrisma));
        mockPrisma.team.create.mockResolvedValue({ id: "new-team-1", name: "Acme Workspace" });
        mockPrisma.userInvitation.create.mockResolvedValue({
            id: "invite-1",
            team: { id: "new-team-1", name: "Acme Workspace" },
        });
        mockPrisma.inviteRequest.update.mockResolvedValue({});
        mockPrisma.teamMember.create.mockResolvedValue({});
        mockAudit.mockResolvedValue(undefined);
    });

    it("creates a brand-new team for the approved requester instead of reusing the admin's team", async () => {
        const { PATCH } = await import("./route");

        const response = await PATCH(patchRequest({ action: "approve-request", id: "req-1" }));

        expect(response.status).toBe(200);
        expect(mockPrisma.team.create).toHaveBeenCalledWith({ data: { name: "Acme Workspace" } });
        expect(mockPrisma.userInvitation.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ teamId: "new-team-1" }) })
        );
        // Must NOT use the approving admin's own existing team.
        expect(mockPrisma.userInvitation.create).not.toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ teamId: "admins-existing-team" }) })
        );
    });

    it("reserves the founder's placeholder membership as \"owner\", not \"member\"", async () => {
        const { PATCH } = await import("./route");

        await PATCH(patchRequest({ action: "approve-request", id: "req-1" }));

        expect(mockPrisma.teamMember.create).toHaveBeenCalledWith({
            data: { teamId: "new-team-1", email: "founder@example.com", role: "owner", status: "invited" },
        });
    });
});
