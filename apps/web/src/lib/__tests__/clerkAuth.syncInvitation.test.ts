import { vi, Mock } from "vitest";
import { syncClerkUserToApp } from "../clerkAuth";
import { prisma } from "@/lib/db";
import { findValidInvitation } from "@/lib/invitations";
import { UserRole } from "@/types/prisma-safe";

vi.mock("@/lib/db", () => ({
    prisma: {
        user: { findUnique: vi.fn() },
        userInvitation: { findFirst: vi.fn() },
        inviteRequest: { findFirst: vi.fn() },
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

describe("syncClerkUserToApp - invitation claim atomicity & privilege escalation prevention (SEC-07)", () => {
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

        const result = await syncClerkUserToApp({
            clerkUserId: "clerk-1",
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

    it("does not elevate user to SUPER_ADMIN if invitation contained unassignable global role", async () => {
        (findValidInvitation as Mock).mockResolvedValue({
            invitation: { ...invitation, role: "SUPER_ADMIN" },
            error: null,
        });
        mockTx.userInvitation.updateMany.mockResolvedValue({ count: 1 });

        await syncClerkUserToApp({
            clerkUserId: "clerk-admin-exploit",
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

        const result = await syncClerkUserToApp({
            clerkUserId: "clerk-1",
            email: invitation.email,
            inviteToken: "valid-token",
        });

        expect(mockTx.user.create).not.toHaveBeenCalled();
        expect(mockTx.teamMember.create).not.toHaveBeenCalled();
        expect(result).toBeNull();
    });
});
