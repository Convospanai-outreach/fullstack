import { prisma } from "@/lib/db";
import { UserRole } from "@/types/prisma-safe";
import { isAssignableInviteRole } from "@/lib/invitations";
import { FREE_TEAM_INITIAL_CREDITS } from "@/lib/googleOnboarding";

// Gives a password-signup user their team once their email is verified.
// Deliberately not run at registration: a pending invitation or domain claim for
// an address must only be honoured for whoever actually controls that inbox.
// No-op if the user already has a membership, so it is safe to call repeatedly.
// (Google's `hd` domain auto-join is intentionally absent - that is a
// Google-only trust signal.)
export async function provisionUserTeam(email: string) {
    const normalized = email.toLowerCase();
    const user = await prisma.user.findUnique({
        where: { email: normalized },
        include: { memberships: { select: { id: true } } },
    });
    if (!user || user.memberships.length > 0) return;

    const now = new Date();
    const pendingInvitation = await prisma.userInvitation.findFirst({
        where: { email: normalized, status: "pending", expiresAt: { gt: now } },
        orderBy: { createdAt: "desc" },
    });

    await prisma.$transaction(async (tx: any) => {
        if (pendingInvitation) {
            const claim = await tx.userInvitation.updateMany({
                where: { id: pendingInvitation.id, status: "pending", expiresAt: { gt: now } },
                data: { status: "accepted", acceptedAt: now },
            });
            if (claim.count > 0) {
                await tx.user.update({
                    where: { id: user.id },
                    data: {
                        enterpriseRole: isAssignableInviteRole(pendingInvitation.role)
                            ? pendingInvitation.role
                            : UserRole.VIEWER,
                    },
                });

                const existingMember = await tx.teamMember.findFirst({
                    where: { teamId: pendingInvitation.teamId, email: normalized },
                });
                if (existingMember) {
                    await tx.teamMember.update({
                        where: { id: existingMember.id },
                        data: { userId: user.id, status: "active" },
                    });
                } else {
                    // Same mapping as syncGoogleUserToApp: a founder invite (inviteRequestId)
                    // owns its brand-new team.
                    const role = pendingInvitation.inviteRequestId
                        ? "owner"
                        : pendingInvitation.role === UserRole.ORG_ADMIN
                            ? "admin"
                            : pendingInvitation.role === UserRole.VIEWER
                                ? "viewer"
                                : "member";
                    await tx.teamMember.create({
                        data: { teamId: pendingInvitation.teamId, userId: user.id, email: normalized, role, status: "active" },
                    });
                }
                return;
            }
        }

        await tx.team.create({
            data: {
                name: user.company?.trim() || (user.name ? `${user.name}'s Team` : "My Team"),
                credits: FREE_TEAM_INITIAL_CREDITS,
                members: { create: { userId: user.id, email: normalized, role: "owner", status: "active" } },
            },
        });
    });
}
