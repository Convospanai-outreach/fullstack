import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export type TriggerType = "lead.replied" | "email.opened" | "ai.suggestion";
export type ActionType = "campaign.stop" | "email.reply" | "lead.tag" | "webhook.call";

class AutomationService {
    async evaluate(teamId: string, trigger: TriggerType, context: Record<string, any>) {
        const automations = await prisma.automation.findMany({
            where: { teamId, trigger, isActive: true }
        });

        const results = [];
        for (const automation of automations) {
            if (automation.requiresApproval) {
                const log = await prisma.automationLog.create({
                    data: {
                        automationId: automation.id,
                        status: "pending_approval",
                        input: (context ?? {}) as Prisma.InputJsonValue,
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
                // context ids are caller-supplied: scope by teamId so an automation can
                // never touch another team's campaign or lead.
                if (automation.action === "campaign.stop" && context?.campaignId) {
                    const { count } = await prisma.campaign.updateMany({
                        where: { id: context.campaignId, teamId },
                        data: { status: "paused" }
                    });
                    if (count === 0) throw new Error("campaign not found");
                } else if (automation.action === "lead.tag" && context?.leadId && context?.tag) {
                    const { count } = await prisma.lead.updateMany({
                        where: { id: context.leadId, teamId },
                        data: { tags: { push: context.tag } }
                    });
                    if (count === 0) throw new Error("lead not found");
                }
            } catch (e) {
                status = "failed";
            }

            const log = await prisma.automationLog.create({
                data: {
                    automationId: automation.id,
                    status,
                    input: (context ?? {}) as Prisma.InputJsonValue,
                    output: { status },
                    executedAt: new Date()
                }
            });

            results.push({ automationId: automation.id, status: status.toUpperCase(), logId: log.id });
        }

        return { success: true, results };
    }

    async approveLog(teamId: string, logId: string) {
        const log = await prisma.automationLog.findUnique({
            where: { id: logId },
            include: { automation: true }
        });

        if (!log || log.automation.teamId !== teamId) {
            throw new Error("Not found");
        }

        return prisma.automationLog.update({
            where: { id: logId },
            data: { status: "success", executedAt: new Date() }
        });
    }
}

export const automationService = new AutomationService();
