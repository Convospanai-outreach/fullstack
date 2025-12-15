
import { NextResponse } from "next/server";
import { TeamService } from "@/modules/teams/service/TeamService";
import { getCurrentContext } from "@/lib/auth";
import { handleAPIError, successResponse, APIError } from "@/lib/apiResponse";

export async function GET() {
    try {
        const { teamId } = await getCurrentContext();
        if (!teamId) throw new APIError("Unauthorized", 401);

        const members = await TeamService.getMembers(teamId);
        return successResponse(members);
    } catch (error: any) {
        return handleAPIError(error);
    }
}

export async function POST(req: Request) {
    try {
        const { teamId } = await getCurrentContext();
        if (!teamId) throw new APIError("Unauthorized", 401);

        // Simple authorization check - in real app, might check if userRole is admin
        // For MVP, assuming any authenticated user can invite for now, or check generic context

        const { email, role } = await req.json();

        if (!email) throw new APIError("Email is required", 400);

        const member = await TeamService.inviteMember(teamId, email, role);
        return successResponse(member);
    } catch (error: any) {
        return handleAPIError(error);
    }
}
