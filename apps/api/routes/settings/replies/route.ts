import { NextRequest, NextResponse } from "next/server";
import { APIError, handleAPIError } from "@/lib/apiResponse";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkTeamPermission, TeamRole } from "@/lib/permissions";
import { readReplyFlowSettings, readReplySendingWindow, replyFlowUpdateSchema } from "@/lib/replyFlowSettings";
import { parseBody } from "@/lib/validation/parseBody";

export async function GET(req: NextRequest) {
    try {
        const { userId, teamId } = await getCurrentContextFromRequest(req);
        if (!userId || !teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const team = await prisma.team.findUnique({ where: { id: teamId }, select: { sendSafety: true } });
        return NextResponse.json({
            ...readReplyFlowSettings(team?.sendSafety),
            sendWindow: readReplySendingWindow(team?.sendSafety),
            canEdit: await checkTeamPermission(userId, teamId, TeamRole.ADMIN),
        });
    } catch (error) {
        return handleAPIError(error);
    }
}

export async function PUT(req: NextRequest) {
    try {
        const { userId, teamId } = await getCurrentContextFromRequest(req);
        if (!userId || !teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        if (!await checkTeamPermission(userId, teamId, TeamRole.ADMIN)) {
            return NextResponse.json({ error: "Admin access required" }, { status: 403 });
        }
        const parsed = await parseBody(req, replyFlowUpdateSchema);
        if (!parsed.ok) return parsed.response;
        const { sendWindow, ...settings } = parsed.data;
        const count = await prisma.$executeRaw`
            UPDATE "Team" SET "sendSafety" = jsonb_set(
                CASE WHEN ${sendWindow ? JSON.stringify(sendWindow) : null}::jsonb IS NOT NULL THEN jsonb_set(
                    CASE WHEN jsonb_typeof("sendSafety") = 'object' THEN "sendSafety" ELSE '{}'::jsonb END,
                    '{sendWindow}', ${sendWindow ? JSON.stringify(sendWindow) : null}::jsonb
                ) ELSE CASE WHEN jsonb_typeof("sendSafety") = 'object' THEN "sendSafety" ELSE '{}'::jsonb END END,
                '{replyFlow}', ${JSON.stringify(settings)}::jsonb
            ), "updatedAt" = now()
            WHERE id = ${teamId}`;
        if (!count) throw new APIError("Team not found.", 404, "TEAM_NOT_FOUND");
        if (!settings.followUpPlans) {
            const { pauseTeamReplySubsequences } = await import("@/modules/inbox/replySubsequenceService");
            await pauseTeamReplySubsequences(teamId);
        }
        const team = await prisma.team.findUnique({ where: { id: teamId }, select: { sendSafety: true } });
        return NextResponse.json({ settings, sendWindow: sendWindow ?? readReplySendingWindow(team?.sendSafety), canEdit: true });
    } catch (error) {
        return handleAPIError(error);
    }
}
