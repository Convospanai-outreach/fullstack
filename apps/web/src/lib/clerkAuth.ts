import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { UserRole } from "@/types/prisma-safe";

type AppUserWithMemberships = {
    id: string;
    email: string | null;
    name: string | null;
    enterpriseRole: UserRole | string | null;
    memberships: Array<{ teamId: string; status: string }>;
};

function primaryEmail(user: Awaited<ReturnType<typeof currentUser>>) {
    const primaryId = user?.primaryEmailAddressId;
    const primary = user?.emailAddresses.find((email) => email.id === primaryId);
    return (primary?.emailAddress || user?.emailAddresses[0]?.emailAddress || "").toLowerCase();
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

    return syncClerkUserToApp({
        clerkUserId,
        email,
        name: clerkUser?.fullName || clerkUser?.firstName || email
    });
}

export async function syncClerkUserToApp(input: { clerkUserId: string; email: string; name?: string | null }) {
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
    const now = new Date();

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
