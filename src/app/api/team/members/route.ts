import { NextRequest, NextResponse } from "next/server";
import { teamService } from "@/modules/team/service/teamService";
import { TeamRole, checkTeamPermission } from "@/lib/permissions";
import { getCurrentContext } from "@/lib/auth";
import { AuditService } from "@/modules/audit/auditService";
import { prisma } from "@/lib/db";
import { Plan, isPlanEligible } from "@/lib/plans";

export async function GET(req: NextRequest) {
    const ctx = await getCurrentContext();
    if (!ctx.userId || !ctx.teamId) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const members = await teamService.getMembers(ctx.teamId);
    return NextResponse.json({ success: true, data: members });
}

export async function POST(req: NextRequest) {
    const ctx = await getCurrentContext();
    if (!ctx.userId || !ctx.teamId) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // 1. Permission check
    if (!await checkTeamPermission(ctx.userId, ctx.teamId, TeamRole.ADMIN)) {
        return NextResponse.json({ success: false, error: "Insufficient permissions" }, { status: 403 });
    }

    // 2. Plan check (Only Enterprise can have multiple members)
    const user = await prisma.user.findUnique({
        where: { id: ctx.userId },
        include: { subscription: { include: { plan: true } } }
    });
    const userPlan = user?.subscription?.plan?.name || "FREE";
    if (!isPlanEligible(userPlan, Plan.ENTERPRISE)) {
        return NextResponse.json({ success: false, error: "Team expansion requires an Enterprise plan upgrade" }, { status: 403 });
    }

    try {
        const body = await req.json();
        const { email, role } = body;

        if (!email) return NextResponse.json({ success: false, error: "Email required" }, { status: 400 });

        const member = await teamService.inviteMember(ctx.teamId, email, role || "member");

        // Audit
        await AuditService.log(ctx.teamId, ctx.userId, "MEMBER_INVITED", "TeamMember", member.id);

        return NextResponse.json({ success: true, data: member });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
