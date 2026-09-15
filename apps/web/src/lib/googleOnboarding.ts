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

// Invite/onboarding logic for Google sign-ins. Signup is open: a brand-new
// email with no matching invite or inviteRequest gets its own new team
// rather than being denied (see the fallback below).
export async function syncGoogleUserToApp(input: { email: string; name?: string | null; inviteToken?: string | undefined; hostedDomain?: string | null | undefined }): Promise<AppUserWithMemberships | null> {
    const email = input.email.toLowerCase();
    if (!email) return null;

    if (await isSsoEnforcedForEmail(email)) {
        return null;
    }

    const existingByEmail = await prisma.user.findUnique({
        where: { email },
        include: { memberships: true }
    }) as AppUserWithMemberships | null;

    if (existingByEmail) return existingByEmail;

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

    // Google Workspace auto-join: `hostedDomain` is Google's `hd` claim, which
    // is only ever present for a Workspace account - a personal Gmail login
    // never carries it - so this can't be spoofed by someone outside the
    // company. The owning team is whichever team's domain check for this
    // domain reached VERIFIED first (first-team-wins: that team is the one
    // that actually controls the domain's DNS, per the DomainAuthenticationCheck
    // flow in setup). An explicit invite (checked above) always takes priority
    // over this - it names a specific team/role, so auto-join must never
    // override it.
    if (input.hostedDomain) {
        const owningDomainCheck = await prisma.domainAuthenticationCheck.findFirst({
            where: { domain: input.hostedDomain.toLowerCase(), status: "VERIFIED" },
            orderBy: { createdAt: "asc" },
            select: { teamId: true }
        });

        if (owningDomainCheck) {
            return prisma.$transaction(async (tx: any) => {
                const user = await tx.user.create({
                    data: {
                        email,
                        name: input.name || email,
                        emailVerified: now,
                        settings: { create: { theme: "dark" } }
                    },
                    include: { memberships: true }
                });

                const existingMember = await tx.teamMember.findFirst({
                    where: { teamId: owningDomainCheck.teamId, email }
                });

                if (existingMember) {
                    await tx.teamMember.update({
                        where: { id: existingMember.id },
                        data: { userId: user.id, status: "active" }
                    });
                } else {
                    await tx.teamMember.create({
                        data: { teamId: owningDomainCheck.teamId, userId: user.id, email, role: "member", status: "active" }
                    });
                }

                return tx.user.findUnique({
                    where: { id: user.id },
                    include: { memberships: true }
                });
            }) as Promise<AppUserWithMemberships | null>;
        }
    }

    const approvedInvite = await prisma.inviteRequest.findFirst({
        where: {
            email,
            status: { in: ["APPROVED", "INVITED"] }
        },
        orderBy: { approvedAt: "desc" }
    });

    const displayName = input.name || approvedInvite?.name || email;
    // Signup is open: no matching invite/inviteRequest just means this person
    // is starting their own team, not a denial - mirrors setupUser()'s
    // default-team pattern in apps/web/src/lib/auth.ts.
    const teamName = approvedInvite
        ? (() => {
            const companyName = (approvedInvite.company || "My Team").trim();
            return companyName.toLowerCase().endsWith("workspace") ? companyName : `${companyName} Workspace`;
        })()
        : (input.name ? `${input.name}'s Team` : "My Team");

    return prisma.$transaction(async (tx: any) => {
        const user = await tx.user.create({
            data: {
                email,
                name: displayName,
                emailVerified: now,
                settings: { create: { theme: "dark" } }
            },
            include: { memberships: true }
        });

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

        if (approvedInvite) {
            await tx.inviteRequest.update({
                where: { id: approvedInvite.id },
                data: { status: "USED", usedAt: now }
            });
        }

        return tx.user.findUnique({
            where: { id: user.id },
            include: { memberships: true }
        });
    }) as Promise<AppUserWithMemberships>;
}
