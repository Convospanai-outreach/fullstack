import { NextResponse } from "next/server";
import { teamService } from "@/modules/team/service/teamService";
import { getCurrentContext } from "@/lib/auth";
import { handleAPIError, successResponse, APIError } from "@/lib/apiResponse";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    try {
        const { teamId } = await getCurrentContext();
        if (!teamId) throw new APIError("Unauthorized", 401);

        const { role } = await req.json();
        const member = await teamService.updateRole(teamId, params.id, role);
        return successResponse(member);
    } catch (error: any) {
        return handleAPIError(error);
    }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    try {
        const { teamId } = await getCurrentContext();
        if (!teamId) throw new APIError("Unauthorized", 401);

        await teamService.removeMember(teamId, params.id);
        return successResponse({ success: true });
    } catch (error: any) {
        return handleAPIError(error);
    }
}
