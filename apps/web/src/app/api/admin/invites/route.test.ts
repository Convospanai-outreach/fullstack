import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFindOrCreateClerkAppUser, mockPrisma, mockAudit, mockIsSuperAdminRole } = vi.hoisted(() => ({
    mockFindOrCreateClerkAppUser: vi.fn(),
    mockAudit: vi.fn(),
    mockIsSuperAdminRole: vi.fn().mockReturnValue(true),
    mockPrisma: {
        inviteRequest: { findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn() },
        team: { create: vi.fn() },
        userInvitation: { create: vi.fn(), findMany: vi.fn() },
        teamMember: { create: vi.fn(), findFirst: vi.fn() },
        $transaction: vi.fn(),
    },
}));

vi.mock("next-auth", () => ({ getServerSession: vi.fn().mockResolvedValue(null) }));
vi.mock("@clerk/nextjs/server", () => ({ clerkClient: vi.fn() }));
vi.mock("@/lib/auth", () => ({
    authOptions: {},
    canInviteUsers: () => true,
    isSuperAdminRole: mockIsSuperAdminRole,
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
        mockIsSuperAdminRole.mockReturnValue(true);
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

describe("/api/admin/invites - InviteRequest actions are platform-admin-only", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFindOrCreateClerkAppUser.mockResolvedValue({
            id: "org-admin-1",
            enterpriseRole: "ORG_ADMIN",
            memberships: [{ teamId: "org-admins-team", status: "active" }],
        });
        mockPrisma.userInvitation.findMany.mockResolvedValue([]);
    });

    it("does not let a workspace-level ORG_ADMIN see the platform-wide invite-request waitlist", async () => {
        mockIsSuperAdminRole.mockReturnValue(false);
        const { GET } = await import("./route");

        const response = await GET();
        const body = await response.json();

        expect(body.inviteRequests).toEqual([]);
        expect(mockPrisma.inviteRequest.findMany).not.toHaveBeenCalled();
    });

    it("lets a genuine platform admin see the invite-request waitlist", async () => {
        mockIsSuperAdminRole.mockReturnValue(true);
        mockPrisma.inviteRequest.findMany.mockResolvedValue([{ id: "req-1" }]);
        const { GET } = await import("./route");

        const response = await GET();
        const body = await response.json();

        expect(body.inviteRequests).toEqual([{ id: "req-1" }]);
    });

    it.each(["reject-request", "mark-used-request", "approve-request"])(
        "refuses a workspace-level ORG_ADMIN's %s on another company's invite request",
        async (action) => {
            mockIsSuperAdminRole.mockReturnValue(false);
            const { PATCH } = await import("./route");

            const response = await PATCH(patchRequest({ action, id: "req-from-another-company" }));

            expect(response.status).toBe(403);
            expect(mockPrisma.inviteRequest.update).not.toHaveBeenCalled();
            expect(mockPrisma.inviteRequest.findUnique).not.toHaveBeenCalled();
        }
    );

    it("allows a genuine platform admin to reject an invite request", async () => {
        mockIsSuperAdminRole.mockReturnValue(true);
        mockPrisma.inviteRequest.update.mockResolvedValue({ id: "req-1", status: "REJECTED" });
        const { PATCH } = await import("./route");

        const response = await PATCH(patchRequest({ action: "reject-request", id: "req-1" }));

        expect(response.status).toBe(200);
        expect(mockPrisma.inviteRequest.update).toHaveBeenCalledWith({
            where: { id: "req-1" },
            data: { status: "REJECTED" },
        });
    });
});
