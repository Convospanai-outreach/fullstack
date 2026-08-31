import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
    const ctx = await getCurrentContext();
    if (!ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { trigger, context } = body;
    if (!trigger) return NextResponse.json({ error: "trigger required" }, { status: 400 });

    const automations = await prisma.automation.findMany({
        where: { teamId: ctx.teamId, trigger, isActive: true }
    });

    const results = [];
    for (const automation of automations) {
        if (automation.requiresApproval) {
            const log = await prisma.automationLog.create({
                data: {
                    automationId: automation.id,
                    status: "pending_approval",
                    input: context ?? {},
                    reasoning: "Requires human approval",
                    tokensUsed: 0,
                    cost: 0
                }
            });
            results.push({ automationId: automation.id, status: "PENDING_APPROVAL", logId: log.id });
            continue;
        }

        let status = "success";
        try {
            if (automation.action === "campaign.stop" && context?.campaignId) {
                // Scoped to ctx.teamId - context is attacker-controlled request input, so
                // without this an automation could be used to pause/tag another team's
                // campaign/lead by passing its id.
                const result = await prisma.campaign.updateMany({
                    where: { id: context.campaignId, teamId: ctx.teamId },
                    data: { status: "paused" }
                });
                if (result.count === 0) status = "failed";
            } else if (automation.action === "lead.tag" && context?.leadId && context?.tag) {
                const result = await prisma.lead.updateMany({
                    where: { id: context.leadId, teamId: ctx.teamId },
                    data: { tags: { push: context.tag } }
                });
                if (result.count === 0) status = "failed";
            }
        } catch (e) {
            status = "failed";
        }

        const log = await prisma.automationLog.create({
            data: {
                automationId: automation.id,
                status,
                input: context ?? {},
                output: { status },
                executedAt: new Date()
            }
        });

        results.push({ automationId: automation.id, status: status.toUpperCase(), logId: log.id });
    }

    return NextResponse.json({ success: true, results });
}
