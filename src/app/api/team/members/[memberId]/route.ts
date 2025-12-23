import { NextRequest, NextResponse } from "next/server";
import { teamService } from "@/modules/team/service/teamService";
import { TeamRole, checkTeamPermission } from "@/lib/permissions";
import { getCurrentContext } from "@/lib/auth";
import { AuditService } from "@/modules/audit/auditService";

export async function PATCH(
    req: NextRequest,
    { params }: { params: { memberId: string } }
) {
    const ctx = await getCurrentContext();
    if (!ctx.userId || !ctx.teamId) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // Only Admin+ can change roles
    if (!await checkTeamPermission(ctx.userId, ctx.teamId, TeamRole.ADMIN)) {
        return NextResponse.json({ success: false, error: "Insufficient permissions" }, { status: 403 });
    }

    try {
        const body = await req.json();
        const { role } = body;

        if (!role) return NextResponse.json({ success: false, error: "Missing role" }, { status: 400 });

        // Extra check: Only Owner can make someone an Admin or Owner
        if ((role === TeamRole.ADMIN || role === TeamRole.OWNER) &&
            !await checkTeamPermission(ctx.userId, ctx.teamId, TeamRole.OWNER)) {
            return NextResponse.json({ success: false, error: "Only owners can promote to Admin/Owner" }, { status: 403 });
        }

        const member = await teamService.updateRole(ctx.teamId, params.memberId, role);

        // Audit
        await AuditService.log(ctx.teamId, ctx.userId, "MEMBER_ROLE_UPDATED", "TeamMember", params.memberId, { newRole: role });

        return NextResponse.json({ success: true, data: member });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: { memberId: string } }
) {
    const ctx = await getCurrentContext();
    if (!ctx.userId || !ctx.teamId) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // Only Admin+ can remove members
    if (!await checkTeamPermission(ctx.userId, ctx.teamId, TeamRole.ADMIN)) {
        return NextResponse.json({ success: false, error: "Insufficient permissions" }, { status: 403 });
    }

    try {
        await teamService.removeMember(ctx.teamId, params.memberId);

        // Audit
        await AuditService.log(ctx.teamId, ctx.userId, "MEMBER_REMOVED", "TeamMember", params.memberId);

        return NextResponse.json({ success: true });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
