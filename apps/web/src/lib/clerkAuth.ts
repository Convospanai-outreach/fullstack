import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { UserRole } from "@/types/prisma-safe";
import { findValidInvitation, isAssignableInviteRole } from "@/lib/invitations";
import { isSsoEnforcedForEmail } from "@/lib/sso/oidc";

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
    if (existingByClerk) {
        // OPEN-113: re-checked on every call (not cached on the session) so a
        // domain having SSO enforcement turned on takes effect immediately for
        // already-signed-in Clerk sessions too, not just new sign-ins.
        if (existingByClerk.email && (await isSsoEnforcedForEmail(existingByClerk.email))) {
            return null;
        }
        return existingByClerk;
    }

    const clerkUser = await currentUser();
    const email = primaryEmail(clerkUser);
    if (!email) return null;

    if (await isSsoEnforcedForEmail(email)) {
        return null;
    }

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

            const assignedEnterpriseRole = isAssignableInviteRole(pendingInvitation.role)
                ? pendingInvitation.role
                : UserRole.VIEWER;

            const user = await tx.user.create({
                data: {
                    clerkUserId: input.clerkUserId,
                    email,
                    name: input.name || email,
                    emailVerified: now,
                    enterpriseRole: assignedEnterpriseRole,
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
                // inviteRequestId is only ever set on a founder invite created by the
                // admin/invites "approve-request" action (a brand-new team made just for
                // this requester) - never on an ordinary teammate invite into an existing
                // team, so it's a safe signal to grant "owner" here instead of falling
                // through to the normal role mapping below.
                const teamRole = pendingInvitation.inviteRequestId
                    ? "owner"
                    : pendingInvitation.role === UserRole.ORG_ADMIN
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

        const companyName = (approvedInvite.company || "My Team").trim();
        const teamName = companyName.toLowerCase().endsWith("workspace")
            ? companyName
            : `${companyName} Workspace`;

        await tx.team.create({
            data: {
                name: teamName,
                members: {
                    create: {
                        userId: user.id,
                        email,
                        // This branch creates a brand-new team for its founding member -
                        // that member must be "owner" (permissions.ts), not "admin", or
                        // the team permanently has no owner: MANAGE_BILLING is owner-only,
                        // getSubscriptionStatus() looks up role:"owner" to find who to bill,
                        // and PATCH /team/members/[id] requires the actor to already be
                        // OWNER before granting ADMIN/OWNER to anyone - so an "admin"
                        // founder could never even self-promote to fix this after the fact.
                        role: "owner",
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
