import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { UserRole } from "@/types/prisma-safe";
import { findValidInvitation } from "@/lib/invitations";

type AppUserWithMemberships = {
    id: string;
    email: string | null;
    name: string | null;
    enterpriseRole: UserRole | string | null;
    memberships: Array<{ teamId: string; status: string }>;
};

function primaryEmail(user: Awaited<ReturnType<typeof currentUser>>) {
    // Only trust addresses Clerk has actually verified - an unverified address on the
    // account isn't proof the user controls it, and this email is used to auto-match
    // pending team invitations.
    const verified = user?.emailAddresses.filter((email) => email.verification?.status === "verified") ?? [];
    const primary = verified.find((email) => email.id === user?.primaryEmailAddressId);
    return (primary?.emailAddress || verified[0]?.emailAddress || "").toLowerCase();
}

export async function getClerkUserId() {
    try {
        const authState = await auth();
        return authState.userId || null;
    } catch {
        return null;
    }
}

export async function findOrCreateClerkAppUser(): Promise<AppUserWithMemberships | null> {
    const clerkUserId = await getClerkUserId();
    if (!clerkUserId) return null;

    const existingByClerk = await prisma.user.findUnique({
        where: { clerkUserId },
        include: { memberships: true }
    }) as AppUserWithMemberships | null;
    if (existingByClerk) return existingByClerk;

    const clerkUser = await currentUser();
    const email = primaryEmail(clerkUser);
    if (!email) return null;

    const inviteToken = clerkUser?.unsafeMetadata?.["inviteToken"];

    return syncClerkUserToApp({
        clerkUserId,
        email,
        name: clerkUser?.fullName || clerkUser?.firstName || email,
        inviteToken: typeof inviteToken === "string" ? inviteToken : undefined
    });
}

export async function syncClerkUserToApp(input: { clerkUserId: string; email: string; name?: string | null; inviteToken?: string | undefined }) {
    const email = input.email.toLowerCase();
    if (!email) return null;

    const existingByClerk = await prisma.user.findUnique({
        where: { clerkUserId: input.clerkUserId },
        include: { memberships: true }
    }) as AppUserWithMemberships | null;
    if (existingByClerk) return existingByClerk;

    const existingByEmail = await prisma.user.findUnique({
        where: { email },
        include: { memberships: true }
    }) as AppUserWithMemberships | null;

    if (existingByEmail) {
        return prisma.user.update({
            where: { id: existingByEmail.id },
            data: { clerkUserId: input.clerkUserId },
            include: { memberships: true }
        }) as Promise<AppUserWithMemberships>;
    }

    const now = new Date();

    // Prefer the exact invitation the user's link/token pointed at. Only fall back to
    // an email-only lookup (ambiguous when the same email has multiple pending
    // invitations from different teams) when no token made it through signup at all -
    // if a token WAS supplied but is invalid/expired/for a different email, don't
    // silently substitute a different team's invitation instead.
    let pendingInvitation = null as Awaited<ReturnType<typeof prisma.userInvitation.findFirst>>;
    if (input.inviteToken) {
        const { invitation } = await findValidInvitation(input.inviteToken);
        if (invitation && invitation.email.toLowerCase() === email) {
            pendingInvitation = invitation;
        }
    } else {
        pendingInvitation = await prisma.userInvitation.findFirst({
            where: { email, status: "pending", expiresAt: { gt: now } },
            orderBy: { createdAt: "desc" }
        });
    }

    if (pendingInvitation) {
        return prisma.$transaction(async (tx: any) => {
            // Re-check and claim atomically inside the transaction: the lookup above
            // ran before this transaction started, so between then and now the
            // invitation could have been revoked or expired. Claiming it here with
            // the same pending/unexpired condition (instead of an unconditional
            // update by id) means a stale invitation can no longer grant access.
            const claim = await tx.userInvitation.updateMany({
                where: { id: pendingInvitation.id, status: "pending", expiresAt: { gt: now } },
                data: { status: "accepted", acceptedAt: now }
            });
            if (claim.count === 0) {
                return null;
            }

            const user = await tx.user.create({
                data: {
                    clerkUserId: input.clerkUserId,
                    email,
                    name: input.name || email,
                    emailVerified: now,
                    enterpriseRole: pendingInvitation.role,
                    settings: { create: { theme: "dark" } }
                },
                include: { memberships: true }
            });

            const existingMember = await tx.teamMember.findFirst({
                where: { teamId: pendingInvitation.teamId, email }
            });

            if (existingMember) {
                await tx.teamMember.update({
                    where: { id: existingMember.id },
                    data: { userId: user.id, status: "active" }
                });
            } else {
                const teamRole = pendingInvitation.role === UserRole.ORG_ADMIN
                    ? "admin"
                    : pendingInvitation.role === UserRole.VIEWER
                        ? "viewer"
                        : "member";
                await tx.teamMember.create({
                    data: { teamId: pendingInvitation.teamId, userId: user.id, email, role: teamRole, status: "active" }
                });
            }

            return tx.user.findUnique({
                where: { id: user.id },
                include: { memberships: true }
            });
        }) as Promise<AppUserWithMemberships | null>;
    }

    const approvedInvite = await prisma.inviteRequest.findFirst({
        where: {
            email,
            status: { in: ["APPROVED", "INVITED"] }
        },
        orderBy: { approvedAt: "desc" }
    });

    if (!approvedInvite) {
        return null;
    }

    const displayName = input.name || approvedInvite.name || email;

    return prisma.$transaction(async (tx: any) => {
        const user = await tx.user.create({
            data: {
                clerkUserId: input.clerkUserId,
                email,
                name: displayName,
                emailVerified: now,
                settings: { create: { theme: "dark" } }
            },
            include: { memberships: true }
        });

        await tx.team.create({
            data: {
                name: `${approvedInvite.company} Workspace`,
                members: {
                    create: {
                        userId: user.id,
                        email,
                        role: "admin",
                        status: "active"
                    }
                }
            }
        });

        await tx.inviteRequest.update({
            where: { id: approvedInvite.id },
            data: { status: "USED", usedAt: now }
        });

        return tx.user.findUnique({
            where: { id: user.id },
            include: { memberships: true }
        });
    }) as Promise<AppUserWithMemberships>;
}

export async function requireClerkAppUser() {
    const user = await findOrCreateClerkAppUser();
    if (!user) {
        throw new Error("Unauthorized");
    }
    return user;
}
