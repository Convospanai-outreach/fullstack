import { NextRequest, NextResponse } from "next/server";
import { APIError, handleAPIError } from "@/lib/apiResponse";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkTeamPermission, TeamRole } from "@/lib/permissions";
import { resolveReplyFlowSettings } from "@/lib/replyFlowSettings";
import { parseBody } from "@/lib/validation/parseBody";
import { readReplySubsequenceConfig, replySubsequenceConfigSchema } from "@/modules/inbox/replySubsequencePolicy";
import { getDripPlaybook } from "@/modules/playbooks/dripPlaybooks";

type Params = { params: Promise<{ id: string }> };

async function getCampaign(teamId: string, id: string) {
    const campaign = await prisma.campaign.findFirst({ where: { id, teamId }, select: { aiConfig: true } });
    const kind = (campaign?.aiConfig as { dripPlaybook?: { kind?: unknown } } | null)?.dripPlaybook?.kind;
    if (typeof kind !== "string" || !getDripPlaybook(kind)) throw new APIError("Drip playbook not found.", 404, "PLAYBOOK_NOT_FOUND");
    return { aiConfig: campaign?.aiConfig, kind };
}

export async function GET(req: NextRequest, { params }: Params) {
    try {
        const { userId, teamId } = await getCurrentContextFromRequest(req);
        if (!userId || !teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { id } = await params;
        const campaign = await getCampaign(teamId, id);
        const team = await prisma.team.findUnique({ where: { id: teamId }, select: { sendSafety: true } });
        return NextResponse.json({
            masterEnabled: resolveReplyFlowSettings(team?.sendSafety).followUpPlans,
            config: readReplySubsequenceConfig(campaign.aiConfig),
            canEdit: await checkTeamPermission(userId, teamId, TeamRole.ADMIN),
        });
    } catch (error) {
        return handleAPIError(error);
    }
}

export async function PUT(req: NextRequest, { params }: Params) {
    try {
        const { userId, teamId } = await getCurrentContextFromRequest(req);
        if (!userId || !teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        if (!await checkTeamPermission(userId, teamId, TeamRole.ADMIN)) {
            return NextResponse.json({ error: "Admin access required" }, { status: 403 });
        }
        const parsed = await parseBody(req, replySubsequenceConfigSchema);
        if (!parsed.ok) return parsed.response;
        const { id } = await params;
        const { kind } = await getCampaign(teamId, id);
        if (parsed.data.enabled) {
            const team = await prisma.team.findUnique({ where: { id: teamId }, select: { sendSafety: true } });
            const settings = resolveReplyFlowSettings(team?.sendSafety);
            if (!settings.followUpPlans || parsed.data.steps.length > settings.maxSteps
                || parsed.data.steps.some((offset, index) => index > 0 && offset - parsed.data.steps[index - 1]! < settings.minSpacingHours)) {
                throw new APIError("These steps are disabled or exceed the limits in Replies & Follow-ups settings.", 409, "PLAN_DISABLED");
            }
        }
        const changed = await prisma.$executeRaw`
            UPDATE "Campaign" SET "aiConfig" = jsonb_set(
                "aiConfig", '{dripPlaybook,replySubsequence}', ${JSON.stringify(parsed.data)}::jsonb
            ), "updatedAt" = now()
            WHERE id = ${id} AND "teamId" = ${teamId} AND "aiConfig" #>> '{dripPlaybook,kind}' = ${kind}`;
        if (!changed) throw new APIError("Drip playbook not found.", 404, "PLAYBOOK_NOT_FOUND");
        return NextResponse.json({ config: parsed.data.enabled ? parsed.data : null });
    } catch (error) {
        return handleAPIError(error);
    }
}
