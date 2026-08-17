import { vi, Mock } from "vitest";
import { syncClerkUserToApp } from "../clerkAuth";
import { prisma } from "@/lib/db";
import { findValidInvitation } from "@/lib/invitations";

vi.mock("@/lib/db", () => ({
    prisma: {
        user: { findUnique: vi.fn() },
        userInvitation: { findFirst: vi.fn() },
        inviteRequest: { findFirst: vi.fn() },
        $transaction: vi.fn(),
    },
}));

vi.mock("@/lib/invitations", () => ({
    findValidInvitation: vi.fn(),
}));

describe("syncClerkUserToApp - invitation claim atomicity", () => {
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
        expect(mockTx.user.create).toHaveBeenCalled();
        expect(mockTx.teamMember.create).toHaveBeenCalled();
        expect(result).toEqual({ id: "user-1", memberships: [] });
    });

    it("does not create a user or grant membership if the invitation was revoked/expired concurrently", async () => {
        // The pre-transaction lookup (findValidInvitation) still returned the invitation as
        // valid, but by the time the transaction's conditional claim runs, it no longer
        // matches status:"pending" (revoked/expired in the race window) - updateMany matches
        // zero rows.
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
