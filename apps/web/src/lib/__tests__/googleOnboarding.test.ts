import { vi, Mock } from "vitest";
import { syncGoogleUserToApp } from "../googleOnboarding";
import { prisma } from "@/lib/db";
import { findValidInvitation } from "@/lib/invitations";
import { isSsoEnforcedForEmail } from "@/lib/sso/oidc";
import { UserRole } from "@/types/prisma-safe";

vi.mock("@/lib/db", () => ({
    prisma: {
        user: { findUnique: vi.fn() },
        userInvitation: { findFirst: vi.fn() },
        inviteRequest: { findFirst: vi.fn(), update: vi.fn() },
        $transaction: vi.fn(),
    },
}));

vi.mock("@/lib/invitations", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/invitations")>();
    return {
        ...actual,
        findValidInvitation: vi.fn(),
    };
});

vi.mock("@/lib/sso/oidc", () => ({ isSsoEnforcedForEmail: vi.fn() }));

describe("syncGoogleUserToApp - SSO enforcement", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("denies provisioning a brand-new user whose domain has SSO enforced", async () => {
        (isSsoEnforcedForEmail as Mock).mockResolvedValue(true);
        (prisma.user.findUnique as Mock).mockResolvedValue(null);

        const result = await syncGoogleUserToApp({ email: "new@enterprise.com" });

        expect(result).toBeNull();
        expect(isSsoEnforcedForEmail).toHaveBeenCalledWith("new@enterprise.com");
        expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });
});

describe("syncGoogleUserToApp - invitation claim atomicity & privilege escalation prevention (SEC-07)", () => {
    const invitation = {
        id: "inv-1",
        email: "new-user@example.com",
        teamId: "team-1",
        role: "SALES_USER",
    };

    const mockTx = {
        userInvitation: { updateMany: vi.fn() },
        user: { create: vi.fn(), findUnique: vi.fn() },
        teamMember: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
    };

    beforeEach(() => {
        vi.clearAllMocks();
        (isSsoEnforcedForEmail as Mock).mockResolvedValue(false);
        (prisma.user.findUnique as Mock).mockResolvedValue(null);
        (findValidInvitation as Mock).mockResolvedValue({ invitation, error: null });
        (prisma.$transaction as Mock).mockImplementation((cb: any) => cb(mockTx));
        mockTx.teamMember.findFirst.mockResolvedValue(null);
        mockTx.teamMember.create.mockResolvedValue({});
        mockTx.user.create.mockResolvedValue({ id: "user-1" });
        mockTx.user.findUnique.mockResolvedValue({ id: "user-1", memberships: [] });
    });

    it("creates the user and membership when the invitation claim succeeds", async () => {
        mockTx.userInvitation.updateMany.mockResolvedValue({ count: 1 });

        const result = await syncGoogleUserToApp({
            email: invitation.email,
            inviteToken: "valid-token",
        });

        expect(mockTx.userInvitation.updateMany).toHaveBeenCalledWith({
            where: { id: invitation.id, status: "pending", expiresAt: expect.any(Object) },
            data: { status: "accepted", acceptedAt: expect.any(Date) },
        });
        expect(mockTx.user.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    enterpriseRole: "SALES_USER",
                }),
            })
        );
        expect(mockTx.teamMember.create).toHaveBeenCalled();
        expect(result).toEqual({ id: "user-1", memberships: [] });
    });

    it("grants \"owner\" for a founder invite (inviteRequestId set), ignoring the normal role mapping", async () => {
        (findValidInvitation as Mock).mockResolvedValue({
            invitation: { ...invitation, role: "SALES_USER", inviteRequestId: "req-1" },
            error: null,
        });
        mockTx.userInvitation.updateMany.mockResolvedValue({ count: 1 });

        await syncGoogleUserToApp({
            email: invitation.email,
            inviteToken: "valid-token",
        });

        expect(mockTx.teamMember.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ role: "owner" }) })
        );
    });

    it("still grants the normal mapped role for an ordinary teammate invite (no inviteRequestId)", async () => {
        (findValidInvitation as Mock).mockResolvedValue({
            invitation: { ...invitation, role: "SALES_USER", inviteRequestId: null },
            error: null,
        });
        mockTx.userInvitation.updateMany.mockResolvedValue({ count: 1 });

        await syncGoogleUserToApp({
            email: invitation.email,
            inviteToken: "valid-token",
        });

        expect(mockTx.teamMember.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ role: "member" }) })
        );
    });

    it("does not elevate user to SUPER_ADMIN if invitation contained unassignable global role", async () => {
        (findValidInvitation as Mock).mockResolvedValue({
            invitation: { ...invitation, role: "SUPER_ADMIN" },
            error: null,
        });
        mockTx.userInvitation.updateMany.mockResolvedValue({ count: 1 });

        await syncGoogleUserToApp({
            email: invitation.email,
            inviteToken: "super-admin-token",
        });

        expect(mockTx.user.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    enterpriseRole: UserRole.VIEWER, // Blocked from receiving SUPER_ADMIN
                }),
            })
        );
    });

    it("does not create a user or grant membership if the invitation was revoked/expired concurrently", async () => {
        mockTx.userInvitation.updateMany.mockResolvedValue({ count: 0 });

        const result = await syncGoogleUserToApp({
            email: invitation.email,
            inviteToken: "valid-token",
        });

        expect(mockTx.user.create).not.toHaveBeenCalled();
        expect(mockTx.teamMember.create).not.toHaveBeenCalled();
        expect(result).toBeNull();
    });
});

describe("syncGoogleUserToApp - fresh team creation for an approved InviteRequest founder", () => {
    const approvedInvite = {
        id: "req-1",
        email: "founder@example.com",
        company: "Acme",
        name: "Founder",
        status: "APPROVED",
        approvedAt: new Date(),
    };

    const mockTx = {
        user: { create: vi.fn(), findUnique: vi.fn() },
        team: { create: vi.fn() },
        inviteRequest: { update: vi.fn() },
    };

    beforeEach(() => {
        vi.clearAllMocks();
        (isSsoEnforcedForEmail as Mock).mockResolvedValue(false);
        (prisma.user.findUnique as Mock).mockResolvedValue(null);
        (prisma.userInvitation.findFirst as Mock).mockResolvedValue(null);
        (prisma.inviteRequest.findFirst as Mock).mockResolvedValue(approvedInvite);
        (prisma.$transaction as Mock).mockImplementation((cb: any) => cb(mockTx));
        mockTx.user.create.mockResolvedValue({ id: "user-1" });
        mockTx.team.create.mockResolvedValue({});
        mockTx.inviteRequest.update.mockResolvedValue({});
        mockTx.user.findUnique.mockResolvedValue({ id: "user-1", memberships: [] });
    });

    it("makes the founding member \"owner\", not \"admin\" - the only role permissions.ts grants MANAGE_BILLING to, and the only one that can later promote anyone else on this team", async () => {
        await syncGoogleUserToApp({
            email: approvedInvite.email,
        });

        expect(mockTx.team.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    members: expect.objectContaining({
                        create: expect.objectContaining({ role: "owner" }),
                    }),
                }),
            })
        );
    });
});

describe("syncGoogleUserToApp - open signup (no invite, no inviteRequest)", () => {
    const mockTx = {
        user: { create: vi.fn(), findUnique: vi.fn() },
        team: { create: vi.fn() },
        inviteRequest: { update: vi.fn() },
    };

    beforeEach(() => {
        vi.clearAllMocks();
        (isSsoEnforcedForEmail as Mock).mockResolvedValue(false);
        (prisma.user.findUnique as Mock).mockResolvedValue(null);
        (prisma.userInvitation.findFirst as Mock).mockResolvedValue(null);
        (prisma.inviteRequest.findFirst as Mock).mockResolvedValue(null);
        (prisma.$transaction as Mock).mockImplementation((cb: any) => cb(mockTx));
        mockTx.user.create.mockResolvedValue({ id: "user-1" });
        mockTx.team.create.mockResolvedValue({});
        mockTx.user.findUnique.mockResolvedValue({ id: "user-1", memberships: [] });
    });

    it("auto-creates a personal team as owner for a brand-new email with no invite at all", async () => {
        const result = await syncGoogleUserToApp({ email: "nobody-invited@example.com", name: "Ada Lovelace" });

        expect(mockTx.team.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    name: "Ada Lovelace's Team",
                    members: expect.objectContaining({
                        create: expect.objectContaining({ role: "owner" }),
                    }),
                }),
            })
        );
        expect(mockTx.inviteRequest.update).not.toHaveBeenCalled();
        expect(result).toEqual({ id: "user-1", memberships: [] });
    });

    it("falls back to \"My Team\" when no name is available", async () => {
        await syncGoogleUserToApp({ email: "noname@example.com" });

        expect(mockTx.team.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ name: "My Team" }) })
        );
    });
});
