import { vi } from "vitest";

const { mockPrisma, tx } = vi.hoisted(() => {
    const tx = {
        userInvitation: { updateMany: vi.fn() },
        user: { update: vi.fn() },
        teamMember: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn(), count: vi.fn() },
        team: { create: vi.fn() },
        $queryRaw: vi.fn(),
    };
    return {
        tx,
        mockPrisma: {
            user: { findUnique: vi.fn() },
            userInvitation: { findFirst: vi.fn() },
            $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
        },
    };
});

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/invitations", () => ({ isAssignableInviteRole: (r: string) => r !== "SUPER_ADMIN" }));

import { provisionUserTeam } from "@/lib/passwordOnboarding";
import { FREE_TEAM_INITIAL_CREDITS } from "@/lib/googleOnboarding";

describe("provisionUserTeam", () => {
    const user = { id: "u1", name: "Ada L", company: "Analytical Engines", memberships: [] as { id: string }[] };

    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.user.findUnique.mockResolvedValue(user);
        mockPrisma.userInvitation.findFirst.mockResolvedValue(null);
        tx.teamMember.findFirst.mockResolvedValue(null);
        tx.teamMember.count.mockResolvedValue(0);
    });

    it("creates nothing when a concurrent call added a membership before the row lock was taken", async () => {
        tx.teamMember.count.mockResolvedValue(1);
        await provisionUserTeam("a@b.com");
        expect(tx.team.create).not.toHaveBeenCalled();
    });

    it("is a no-op when the user already has a membership", async () => {
        mockPrisma.user.findUnique.mockResolvedValue({ ...user, memberships: [{ id: "m1" }] });
        await provisionUserTeam("a@b.com");
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it("is a no-op for an unknown email", async () => {
        mockPrisma.user.findUnique.mockResolvedValue(null);
        await provisionUserTeam("nobody@b.com");
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it("creates an owner team named after the company when there is no invitation", async () => {
        await provisionUserTeam("A@B.com");

        expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { email: "a@b.com" } }));
        expect(tx.team.create).toHaveBeenCalledWith({
            data: {
                name: "Analytical Engines",
                credits: FREE_TEAM_INITIAL_CREDITS,
                members: { create: { userId: "u1", email: "a@b.com", role: "owner", status: "active" } },
            },
        });
    });

    it("claims a pending invitation and joins that team with the mapped role instead of creating one", async () => {
        mockPrisma.userInvitation.findFirst.mockResolvedValue({ id: "inv1", teamId: "t1", role: "VIEWER", inviteRequestId: null });
        tx.userInvitation.updateMany.mockResolvedValue({ count: 1 });

        await provisionUserTeam("a@b.com");

        expect(tx.userInvitation.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: expect.objectContaining({ id: "inv1", status: "pending" }) })
        );
        expect(tx.teamMember.create).toHaveBeenCalledWith({
            data: { teamId: "t1", userId: "u1", email: "a@b.com", role: "viewer", status: "active" },
        });
        expect(tx.team.create).not.toHaveBeenCalled();
    });

    it("makes the invitee owner for a founder invite (inviteRequestId set)", async () => {
        mockPrisma.userInvitation.findFirst.mockResolvedValue({ id: "inv2", teamId: "t2", role: "ORG_ADMIN", inviteRequestId: "req1" });
        tx.userInvitation.updateMany.mockResolvedValue({ count: 1 });

        await provisionUserTeam("a@b.com");

        expect(tx.teamMember.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ teamId: "t2", role: "owner" }) })
        );
    });

    it("falls back to creating a team if the invitation was revoked before it could be claimed", async () => {
        mockPrisma.userInvitation.findFirst.mockResolvedValue({ id: "inv3", teamId: "t3", role: "SALES_USER", inviteRequestId: null });
        tx.userInvitation.updateMany.mockResolvedValue({ count: 0 });

        await provisionUserTeam("a@b.com");

        expect(tx.teamMember.create).not.toHaveBeenCalled();
        expect(tx.team.create).toHaveBeenCalled();
    });
});
