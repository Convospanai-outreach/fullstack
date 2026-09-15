import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetServerSession, mockPrisma, mockAudit, mockIsSuperAdminRole } = vi.hoisted(() => ({
    mockGetServerSession: vi.fn(),
    mockAudit: vi.fn(),
    mockIsSuperAdminRole: vi.fn().mockReturnValue(true),
    mockPrisma: {
        user: { findUnique: vi.fn() },
        inviteRequest: { findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn() },
        team: { create: vi.fn() },
        userInvitation: { create: vi.fn(), findMany: vi.fn() },
        teamMember: { create: vi.fn(), findFirst: vi.fn() },
        $transaction: vi.fn(),
    },
}));

vi.mock("next-auth", () => ({ getServerSession: mockGetServerSession }));
vi.mock("@/lib/auth", () => ({
    authOptions: {},
    canInviteUsers: () => true,
    isSuperAdminRole: mockIsSuperAdminRole,
}));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/modules/audit/auditService", () => ({ AuditService: { log: mockAudit } }));
vi.mock("@/lib/invitations", () => ({
    createInviteToken: () => "raw-token",
    getInviteLink: (token: string) => `https://app.example.com/signup?token=${token}`,
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

function postRequest(body: unknown) {
    return new Request("http://localhost/api/admin/invites", {
        method: "POST",
        body: JSON.stringify(body),
    }) as any;
}

describe("PATCH /api/admin/invites - approve-request", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockIsSuperAdminRole.mockReturnValue(true);
        mockGetServerSession.mockResolvedValue({ user: { id: "admin-1" } });
        mockPrisma.user.findUnique.mockResolvedValue({
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
        mockGetServerSession.mockResolvedValue({ user: { id: "org-admin-1" } });
        mockPrisma.user.findUnique.mockResolvedValue({
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

describe("POST /api/admin/invites - bulk invite (setup wizard)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockIsSuperAdminRole.mockReturnValue(false);
        mockGetServerSession.mockResolvedValue({ user: { id: "founder-1" } });
        mockPrisma.user.findUnique.mockResolvedValue({
            id: "founder-1",
            enterpriseRole: "ORG_ADMIN",
            memberships: [{ teamId: "team-1", status: "active" }],
        });
        mockPrisma.userInvitation.create.mockImplementation(({ data }: any) =>
            Promise.resolve({ id: `invite-${data.email}`, ...data })
        );
        mockPrisma.teamMember.findFirst.mockResolvedValue(null);
        mockPrisma.teamMember.create.mockResolvedValue({});
        mockAudit.mockResolvedValue(undefined);
    });

    it("creates one invitation per unique, lowercased email", async () => {
        const { POST } = await import("./route");

        const response = await POST(postRequest({ emails: ["Jane@Example.com", "john@example.com", "jane@example.com"] }));
        const body = await response.json();

        expect(response.status).toBe(201);
        expect(body.results).toHaveLength(2);
        expect(mockPrisma.userInvitation.create).toHaveBeenCalledTimes(2);
        expect(body.results.every((r: any) => r.ok)).toBe(true);
    });

    it("rejects an empty or all-invalid email list", async () => {
        const { POST } = await import("./route");

        const response = await POST(postRequest({ emails: ["not-an-email", "  "] }));

        expect(response.status).toBe(400);
        expect(mockPrisma.userInvitation.create).not.toHaveBeenCalled();
    });

    it("rejects a batch larger than 50 to cap blast radius", async () => {
        const { POST } = await import("./route");

        const emails = Array.from({ length: 51 }, (_, i) => `user${i}@example.com`);
        const response = await POST(postRequest({ emails }));

        expect(response.status).toBe(400);
        expect(mockPrisma.userInvitation.create).not.toHaveBeenCalled();
    });

    it("reports a per-email failure without failing the whole batch", async () => {
        mockPrisma.userInvitation.create
            .mockImplementationOnce(({ data }: any) => Promise.resolve({ id: "invite-ok", ...data }))
            .mockImplementationOnce(() => Promise.reject(new Error("db exploded")));
        const { POST } = await import("./route");

        const response = await POST(postRequest({ emails: ["ok@example.com", "bad@example.com"] }));
        const body = await response.json();

        expect(response.status).toBe(201);
        const ok = body.results.find((r: any) => r.email === "ok@example.com");
        const bad = body.results.find((r: any) => r.email === "bad@example.com");
        expect(ok.ok).toBe(true);
        expect(bad.ok).toBe(false);
        expect(bad.error).toBe("db exploded");
    });
});
