import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AuditService } from "@/modules/audit/auditService";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: { memberships: { include: { team: true } } }
        });

        const team = user?.memberships?.[0]?.team;
        if (!team) {
            return new NextResponse("Workspace Not Found", { status: 404 });
        }

        const logs = await AuditService.getLogs(team.id);

        return NextResponse.json({
            success: true,
            logs,
            workspaceName: team.name
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        logger.error("[Governance API] Failed to fetch audit logs", { error: errorMessage });
        return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
    }
}
