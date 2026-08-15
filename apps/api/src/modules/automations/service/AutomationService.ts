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
