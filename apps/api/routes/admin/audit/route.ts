import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { UserRole } from "@prisma/client";
import { getCurrentContextFromRequest } from "@/lib/auth";

// ORG_ADMIN/COMPLIANCE_OFFICER are normal, self-service-assignable per-workspace
// roles (see the identical framing in admin/actions/[action]/route.ts) - only
// SYSTEM_ADMIN/SUPER_ADMIN are genuine platform-level operators allowed to see
// audit logs across every team.
const PLATFORM_LEVEL_ROLES: UserRole[] = [UserRole.SYSTEM_ADMIN, UserRole.SUPER_ADMIN];

/**
 * Audit Log Viewer API
 * GET /api/admin/audit
 *
 * Only accessible by:
 * - ORG_ADMIN (own team only)
 * - COMPLIANCE_OFFICER (own team only)
 * - SYSTEM_ADMIN / SUPER_ADMIN (platform-wide)
 */
export async function GET(req: NextRequest) {
    const { userId } = await getCurrentContextFromRequest(req);
    const user = userId
        ? await prisma.user.findUnique({ where: { id: userId }, select: { enterpriseRole: true } })
        : null;

    // Authorization check
    const allowedRoles: UserRole[] = [UserRole.ORG_ADMIN, UserRole.COMPLIANCE_OFFICER, UserRole.SYSTEM_ADMIN, UserRole.SUPER_ADMIN];
    if (!user || !allowedRoles.includes(user.enterpriseRole)) {
        return NextResponse.json({ error: "Forbidden - Requires admin access" }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(req.url);

        // Filters
        const action = searchParams.get("action");
        const entityType = searchParams.get("entityType");
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");
        const actorId = searchParams.get("actorId");
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "50");

        const where: any = {};

        if (!PLATFORM_LEVEL_ROLES.includes(user.enterpriseRole)) {
            // A workspace-level ORG_ADMIN/COMPLIANCE_OFFICER may only see their own
            // team's logs, never the whole platform's.
            const membership = await prisma.teamMember.findFirst({
                where: { userId: userId as string },
                select: { teamId: true }
            });
            if (!membership) {
                return NextResponse.json({ error: "Forbidden - No team membership" }, { status: 403 });
            }
            where.orgId = membership.teamId;
        }

        if (action) where.action = action;
        if (entityType) where.entityType = entityType;
        if (actorId) where.actorId = actorId;

        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = new Date(startDate);
            if (endDate) where.createdAt.lte = new Date(endDate);
        }

        // Get total count for pagination
        const total = await prisma.auditLog.count({ where });

        // Fetch logs
        const logs = await prisma.auditLog.findMany({
            where,
            include: {
                user: {
                    select: {
                        name: true,
                        email: true,
                        enterpriseRole: true
                    }
                }
            },
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * limit,
            take: limit
        });

        return NextResponse.json({
            logs,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error: any) {
        console.error("[Audit API] Error:", error);
        return NextResponse.json(
            { error: "Internal server error", details: error.message },
            { status: 500 }
        );
    }
}
