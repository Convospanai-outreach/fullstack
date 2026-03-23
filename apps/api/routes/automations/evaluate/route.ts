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
                await prisma.campaign.update({
                    where: { id: context.campaignId },
                    data: { status: "paused" }
                });
            } else if (automation.action === "lead.tag" && context?.leadId && context?.tag) {
                await prisma.lead.update({
                    where: { id: context.leadId },
                    data: { tags: { push: context.tag } }
                });
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
