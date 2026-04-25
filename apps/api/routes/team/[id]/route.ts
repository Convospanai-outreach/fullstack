import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { APIError, handleAPIError } from "@/lib/apiResponse";
import { authorizeRole, TeamRole, checkTeamPermission } from "@/lib/permissions";
import { teamService } from "@/modules/team/service/teamService";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
    try {
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
        await authorizeRole(userId, teamId, TeamRole.ADMIN);

        const { id } = params;

        const memberToRemove = await prisma.teamMember.findFirst({
            where: { id, teamId }
        });

        if (!memberToRemove) {
            throw new APIError("Member not found or access denied", 403, "FORBIDDEN");
        }

        // Only owners can remove admin/owner members.
        if (
            (memberToRemove.role === TeamRole.ADMIN || memberToRemove.role === TeamRole.OWNER)
            && !(await checkTeamPermission(userId, teamId, TeamRole.OWNER))
        ) {
            throw new APIError("Only owners can remove admin or owner members", 403, "FORBIDDEN");
        }

        await teamService.removeMember(teamId, id);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return handleAPIError(error);
    }
}
