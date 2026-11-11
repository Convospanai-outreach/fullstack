import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { checkTeamPermission, TeamRole } from "@/lib/permissions";
import { internalErrorMessage } from "@/lib/internalError";
import { dripOf, enrollDrip } from "@/modules/playbooks/dripTriggers";

const bodySchema = z.object({ campaignId: z.string().trim().min(1).max(100), leadId: z.string().trim().min(1).max(100) });

// Adds one lead to a drip playbook by hand: how proposal follow-up and missed-call recovery start.
export async function POST(req: NextRequest) {
    try {
        const ctx = await getCurrentContextFromRequest(req);
        if (!ctx.userId || !ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        if (!await checkTeamPermission(ctx.userId, ctx.teamId, TeamRole.MEMBER)) {
            return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
        }
        const body = bodySchema.safeParse(await req.json().catch(() => null));
        if (!body.success) return NextResponse.json({ error: "Choose a playbook and a lead" }, { status: 400 });

        const campaign = await prisma.campaign.findFirst({ where: { id: body.data.campaignId, teamId: ctx.teamId }, select: { id: true, aiConfig: true } });
        if (!campaign || !dripOf(campaign.aiConfig)) return NextResponse.json({ error: "Playbook not found" }, { status: 404 });

        // The owner chose this lead, so consent is their call; opt-outs, replies and suppression still stop it.
        const skipped = await enrollDrip({ id: campaign.id, teamId: ctx.teamId }, body.data.leadId, { requireConsent: false });
        if (skipped) return NextResponse.json({ error: `Not added: ${skipped}` }, { status: 409 });
        return NextResponse.json({ ok: true });
    } catch (err) {
        return NextResponse.json({ error: internalErrorMessage(err) }, { status: 500 });
    }
}
