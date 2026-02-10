import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/db";
import { UserRole } from "@prisma/client";

/**
 * Audit Log Viewer API
 * GET /api/admin/audit
 * 
 * Only accessible by:
 * - ORG_ADMIN
 * - COMPLIANCE_OFFICER
 * - SYSTEM_ADMIN
 */
export async function GET(req: NextRequest) {
    const token = await getToken({ req });

    // Authorization check
    const allowedRoles: UserRole[] = [UserRole.ORG_ADMIN, UserRole.COMPLIANCE_OFFICER, UserRole.SYSTEM_ADMIN];
    if (!token || !allowedRoles.includes(token.enterpriseRole as UserRole)) {
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
