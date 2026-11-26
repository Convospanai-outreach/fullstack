import { NextRequest, NextResponse } from "next/server";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { APIError, handleAPIError } from "@/lib/apiResponse";
import { checkTeamPermission, TeamRole } from "@/lib/permissions";
import { listMailboxReputation } from "@/modules/overseer/mailboxReputationActions";

export async function GET(request: NextRequest) {
    try {
        const { userId, teamId } = await getCurrentContextFromRequest(request);
        if (!userId || !teamId) throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
        if (!await checkTeamPermission(userId, teamId, TeamRole.VIEWER)) throw new APIError("Team access required", 403, "FORBIDDEN");
        return NextResponse.json({ mailboxes: await listMailboxReputation(teamId) });
    } catch (error) {
        return handleAPIError(error);
    }
}
