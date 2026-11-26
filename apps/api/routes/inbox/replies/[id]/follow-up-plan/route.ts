import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleAPIError } from "@/lib/apiResponse";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { checkTeamPermission, TeamRole } from "@/lib/permissions";
import { parseBody } from "@/lib/validation/parseBody";
import { getReplyPlan, replyPlanActionSchema, replyPlanScope, updateReplyPlan } from "@/modules/inbox/replySubsequenceService";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
    try {
        const { teamId, userId } = await getCurrentContextFromRequest(req);
        if (!teamId || !userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        if (!await checkTeamPermission(userId, teamId, TeamRole.MEMBER)) {
            return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
        }
        const { id } = await params;
        const scope = await replyPlanScope(teamId, id);
        return NextResponse.json({ plan: await getReplyPlan(scope) });
    } catch (error) {
        return handleAPIError(error);
    }
}

export async function PATCH(req: NextRequest, { params }: Params) {
    try {
        const { teamId, userId } = await getCurrentContextFromRequest(req);
        if (!teamId || !userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        if (!await checkTeamPermission(userId, teamId, TeamRole.MEMBER)) {
            return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
        }
        const parsed = await parseBody(req, z.object({ runId: z.string().min(1), action: replyPlanActionSchema }));
        if (!parsed.ok) return parsed.response;
        const { id } = await params;
        const scope = await replyPlanScope(teamId, id);
        await updateReplyPlan(scope, userId, parsed.data.action, parsed.data.runId);
        return NextResponse.json({ plan: await getReplyPlan(scope) });
    } catch (error) {
        return handleAPIError(error);
    }
}
