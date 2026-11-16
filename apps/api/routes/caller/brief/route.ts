import { NextRequest, NextResponse } from "next/server";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CallerBriefService } from "@/modules/caller/CallerBriefService";
import { UserRole } from "@prisma/client";

function isAllowed(role?: string) {
    if (!role) return false;
    return (
        role === UserRole.CALLER ||
        role === UserRole.SALES_MANAGER ||
        role === UserRole.ORG_ADMIN ||
        role === UserRole.SYSTEM_ADMIN
    );
}

export async function GET(req: NextRequest) {
    const { userId, teamId } = await getCurrentContextFromRequest(req);
    const user = userId
        ? await prisma.user.findUnique({ where: { id: userId }, select: { enterpriseRole: true } })
        : null;
    if (!userId || !teamId || !user || !isAllowed(user.enterpriseRole)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const leadId = req.nextUrl.searchParams.get("leadId");
    if (!leadId) return NextResponse.json({ error: "leadId required" }, { status: 400 });

    try {
        const brief = await CallerBriefService.getBrief(leadId, teamId);
        if (!brief) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
        return NextResponse.json(brief);
    } catch (error) {
        console.error("Call brief error:", error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
