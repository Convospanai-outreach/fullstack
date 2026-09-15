import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { APIError, handleAPIError } from "@/lib/apiResponse";
import { authorizeRole, TeamRole } from "@/lib/permissions";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { teamId, userId } = await getCurrentContext();
        if (!teamId || !userId) {
            throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
        }
        await authorizeRole(userId, teamId, TeamRole.MEMBER);

        const lead = await prisma.lead.findFirst({ where: { id, teamId }, select: { id: true } });
        if (!lead) {
            throw new APIError("Lead not found", 404, "NOT_FOUND");
        }

        const dataSources = await (prisma as any).leadDataSource.findMany({
            where: { leadId: id },
            orderBy: { capturedAt: "desc" },
        });

        return NextResponse.json({ dataSources });
    } catch (error) {
        return handleAPIError(error);
    }
}
