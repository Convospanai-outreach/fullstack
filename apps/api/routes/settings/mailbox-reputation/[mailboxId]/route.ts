import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { APIError, handleAPIError } from "@/lib/apiResponse";
import { checkTeamPermission, TeamRole } from "@/lib/permissions";
import { parseBody } from "@/lib/validation/parseBody";
import { actOnMailboxReputation, getMailboxReputation } from "@/modules/overseer/mailboxReputationActions";

const actionSchema = z.discriminatedUnion("action", [
    z.object({ action: z.literal("switch"), replacementId: z.string().min(1).max(128) }),
    z.object({ action: z.literal("keep"), confirmation: z.string().max(32) }),
    z.object({ action: z.enum(["recheck", "delay", "resume", "disconnect"]) }),
]);
type Context = { params: Promise<{ mailboxId: string }> };

export async function GET(request: NextRequest, context: Context) {
    try {
        const { userId, teamId } = await getCurrentContextFromRequest(request);
        if (!userId || !teamId) throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
        if (!await checkTeamPermission(userId, teamId, TeamRole.VIEWER)) throw new APIError("Team access required", 403, "FORBIDDEN");
        const { mailboxId } = await context.params;
        const [data, canEdit] = await Promise.all([getMailboxReputation(teamId, mailboxId), checkTeamPermission(userId, teamId, TeamRole.ADMIN)]);
        return NextResponse.json({ ...data, canEdit });
    } catch (error) {
        return handleAPIError(error);
    }
}

export async function POST(request: NextRequest, context: Context) {
    try {
        const { userId, teamId } = await getCurrentContextFromRequest(request);
        if (!userId || !teamId) throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
        if (!await checkTeamPermission(userId, teamId, TeamRole.ADMIN)) throw new APIError("Admin access required", 403, "FORBIDDEN");
        const parsed = await parseBody(request, actionSchema);
        if (!parsed.ok) return parsed.response;
        const { mailboxId } = await context.params;
        return NextResponse.json({ ...await actOnMailboxReputation(teamId, mailboxId, userId, parsed.data), canEdit: true });
    } catch (error) {
        return handleAPIError(error);
    }
}
