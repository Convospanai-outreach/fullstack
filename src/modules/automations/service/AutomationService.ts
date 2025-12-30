import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { notificationService } from "@/modules/notifications/service/notificationService";
import { Automation } from "@prisma/client";

export type TriggerType = "lead.replied" | "email.opened" | "ai.suggestion";
export type ActionType = "campaign.stop" | "email.reply" | "lead.tag" | "webhook.call";

class AutomationService {
    /**
     * Evaluates automations for a given trigger.
     * @param teamId Team ID
     * @param trigger Trigger Name
     * @param context Data contextual to the event (e.g. Lead ID, Campaign ID)
     */
    async evaluate(teamId: string, trigger: TriggerType, context: Record<string, any>) {
        // 1. Fetch active automations for this team & trigger
        const activeAutomations = await prisma.automation.findMany({
            where: { teamId, trigger, isActive: true }
        });

        if (activeAutomations.length === 0) return;

        logger.info(`[AutomationService] Checking ${activeAutomations.length} automations for trigger ${trigger} in team ${teamId}`);

        for (const automation of activeAutomations) {
            await this.processAutomation(automation, context);
        }
    }

    private async processAutomation(automation: Automation, context: Record<string, any>) {
        // 2. Check for Manual Intervention (Human-in-the-Loop)
        if (automation.requiresApproval) {
            await prisma.automationLog.create({
                data: {
                    automationId: automation.id,
                    status: "pending_approval",
                    output: context,
                    tokensUsed: 0,
                    cost: 0
                }
            });

            logger.info(`[AutomationService] Automation ${automation.id} requires approval. Paused.`, { automationId: automation.id });
            await notificationService.sendAlert("warning", `Automation "${automation.name}" requires your approval.`);
            return;
        }

        // 3. Execute Action Immediately
        await this.executeAction(automation, context);
    }

    private async executeAction(automation: Automation, context: Record<string, any>) {
        let status = "success";
        let output: Record<string, any> = {};
        let tokens = 0;

        try {
            logger.info(`[AutomationService] Executing action ${automation.action} for automation ${automation.id}`);
            switch (automation.action as ActionType) {
                case "campaign.stop":
                    if (context['campaignId'] && context['email']) {
                        await prisma.lead.updateMany({
                            where: { id: context['leadId'] as string },
                            data: { status: "STOPPED" }
                        });
                        output = { message: "Campaign stopped for lead" };
                    }
                    break;

                case "email.reply":
                    const { generateWithGemini } = await import("@/ai/gemini");
                    const messageContext = context['message'] || "No message content";
                    const reply = await generateWithGemini(`Write a helpful and professional reply to this message: "${messageContext}". Keep it concise.`);

                    output = { draft: reply };
                    tokens = Math.ceil(reply.length / 4);
                    break;

                case "webhook.call":
                    const config = automation.config as any;
                    if (config?.url) {
                        await fetch(config.url, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(context)
                        });
                        output = { message: "Webhook fired" };
                    }
                    break;

                default:
                    status = "failed";
                    output = { error: "Unknown action type" };
            }
        } catch (error) {
            status = "failed";
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            output = { error: errorMessage };
            logger.error(`[AutomationService] Automation ${automation.id} action execution failed:`, { error: errorMessage });
        }

        // 4. Log Execution
        await prisma.automationLog.create({
            data: {
                automationId: automation.id,
                status,
                output: output,
                tokensUsed: tokens,
                cost: tokens * 0.0000003 // Gemini rate
            }
        });
    }

    /**
     * Approves a pending automation log and executes it.
     */
    async approveLog(logId: string) {
        const log = await prisma.automationLog.findUnique({
            where: { id: logId },
            include: { automation: true }
        });

        if (!log || log.status !== "pending_approval") {
            throw new Error("Log not found or not pending");
        }

        // Execute
        await this.executeAction(log.automation, log.output as Record<string, any>);

        // Update log status to "approved" so it disappears from queue
        await prisma.automationLog.update({
            where: { id: logId },
            data: { status: "approved" }
        });

        logger.info(`[AutomationService] Manually approved and executed automation log ${logId}`);
    }
}

export const automationService = new AutomationService();
