
import { NextResponse } from "next/server";
import { TeamService } from "@/modules/teams/service/TeamService";
import { getCurrentContext } from "@/lib/auth";
import { handleAPIError, successResponse, APIError } from "@/lib/apiResponse";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    try {
        const { teamId } = await getCurrentContext();
        if (!teamId) throw new APIError("Unauthorized", 401);

        const { role } = await req.json();
        const member = await TeamService.updateRole(params.id, role);
        return successResponse(member);
    } catch (error: any) {
        return handleAPIError(error);
    }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    try {
        const { teamId } = await getCurrentContext();
        if (!teamId) throw new APIError("Unauthorized", 401);

        await TeamService.removeMember(params.id);
        return successResponse({ success: true });
    } catch (error: any) {
        return handleAPIError(error);
    }
}
