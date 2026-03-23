import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/governance/audit";
import { Permission, authorizePermission } from "@/lib/permissions";

export async function GET() {
    const { userId, teamId } = await getCurrentContext();
    if (!userId || !teamId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        await authorizePermission(userId, teamId, Permission.MANAGE_BILLING);

        const [policy, userQuotas, members] = await Promise.all([
            prisma.organizationPolicy.findUnique({ where: { organizationId: teamId } }),
            prisma.userQuota.findMany({ where: { teamId }, include: { user: { select: { name: true, email: true } } } }),
            prisma.teamMember.findMany({ where: { teamId, status: "active" }, include: { user: { select: { id: true, name: true, email: true } } } })
        ]);

        return NextResponse.json({
            policy,
            userQuotas,
            members: members.map((m: any) => ({
                id: m.user?.id,
                name: m.user?.name || m.email,
                email: m.user?.email || m.email,
                role: m.role
            }))
        });
    } catch (error: any) {
        console.error("[Budgeting API] GET error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    const { userId, teamId } = await getCurrentContext();
    if (!userId || !teamId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        await authorizePermission(userId, teamId, Permission.MANAGE_BILLING);

        const body = await req.json();
        const { maxCreditsPerUser, requiresApprovalForOverage, userOverrides } = body;

        // 1. Update Global Policy
        if (typeof maxCreditsPerUser === 'number') {
            const updateData: { maxCreditsPerUser: number; requiresApprovalForOverage?: boolean } = {
                maxCreditsPerUser
            };
            if (typeof requiresApprovalForOverage === 'boolean') {
                updateData.requiresApprovalForOverage = requiresApprovalForOverage;
            }
            await prisma.organizationPolicy.update({
                where: { organizationId: teamId },
                data: updateData
            });
        }

        // 2. Handle User Overrides
        if (Array.isArray(userOverrides)) {
            for (const override of userOverrides) {
                await prisma.userQuota.upsert({
                    where: { userId_teamId: { userId: override.userId, teamId } },
                    update: { monthlyLimit: override.monthlyLimit },
                    create: {
                        userId: override.userId,
                        teamId,
                        monthlyLimit: override.monthlyLimit,
                        lastReset: new Date()
                    }
                });
            }
        }

        await audit({
            actorId: userId,
            orgId: teamId,
            action: "UPDATE_BUDGET_POLICY",
            entity: "OrganizationPolicy",
            entityId: teamId,
            metadata: { maxCreditsPerUser, overrideCount: userOverrides?.length }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("[Budgeting API] PUT error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
