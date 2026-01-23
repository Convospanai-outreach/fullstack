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
        // We now check dynamic rules (Campaign Mode) in addition to the static flag
        const requiresApproval = await this.shouldRequireApproval(automation, context);

        if (requiresApproval) {
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

    /**
     * Determines if an automation requires human approval based on:
     * 1. Global "requiresApproval" flag on the automation definition.
     * 2. Campaign AI Configuration (SafeRun vs Autonomous).
     * 3. AI Confidence Score (for Hybrid mode).
     */
    private async shouldRequireApproval(automation: Automation, context: Record<string, any>): Promise<boolean> {
        // 1. Global / Admin Override
        if (automation.requiresApproval) return true;

        // 2. Campaign Context Override
        // 2. Campaign Context Override
        if (context['campaignId']) {
            try {
                const campaign = await prisma.campaign.findUnique({
                    where: { id: context['campaignId'] },
                    select: { aiConfig: true }
                });

                if (campaign?.aiConfig) {
                    const config = campaign.aiConfig as any;
                    const mode = config.executionMode || 'saferun';

                    // SafeRun: Always require approval for external actions
                    // We assume all automations under a campaign are relevant to that campaign's safety
                    if (mode === 'saferun') return true;

                    // Autonomous: Trust the AI completely
                    if (mode === 'autonomous') return false;

                    // Hybrid: Check Confidence
                    if (mode === 'hybrid') {
                        // If confidence is missing, assume it needs approval to be safe
                        const confidence = typeof context['confidence'] === 'number' ? context['confidence'] : 0;
                        // Threshold 0.9 (90%)
                        return confidence < 0.9;
                    }
                }
            } catch (error) {
                logger.error("Failed to fetch campaign config for automation check", error);
                return true; // Fail safe
            }
        }

        return false;
    }

    private async executeAction(automation: Automation, context: Record<string, any>) {
        const result = await this.runActionCore(automation, context);

        // 4. Log Execution
        await prisma.automationLog.create({
            data: {
                automationId: automation.id,
                status: result.status,
                output: result.output,
                tokensUsed: result.tokens,
                cost: result.cost
            }
        });
    }

    /**
     * Core logic to run the action and return result stats.
     * Does NOT log to DB.
     */
    private async runActionCore(automation: Automation, context: Record<string, any>) {
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
                    const { emailService } = await import("@/modules/email-campaigner/service/emailService");

                    const messageContext = context['message'] || "No message content";
                    const reply = await generateWithGemini(`Write a helpful and professional reply to this message: "${messageContext}". Keep it concise.`);

                    // Actually send the email if we have a recipient
                    // We assume context has 'leadEmail' or 'email'
                    const recipient = context['leadEmail'] || context['email'];

                    if (recipient) {
                        await emailService.sendEmail(
                            recipient,
                            "Re: " + (context['subject'] || "Response"),
                            reply,
                            {
                                leadId: context['leadId'],
                                campaignId: context['campaignId']
                            }
                        );
                        output = { draft: reply, sent: true, recipient };
                    } else {
                        output = { draft: reply, sent: false, error: "No recipient email in context" };
                    }

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

        return { status, output, tokens, cost: tokens * 0.0000003 };
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

        // Execute core logic to get headers/drafts
        const result = await this.runActionCore(log.automation, log.output as Record<string, any>);

        // Update log status to "approved" so it disappears from queue
        // AND update output with the result (e.g. the draft)
        await prisma.automationLog.update({
            where: { id: logId },
            data: {
                status: "approved",
                output: {
                    ...(log.output as object),
                    ...result.output
                },
                tokensUsed: result.tokens,
                cost: result.cost
            }
        });

        logger.info(`[AutomationService] Manually approved and prepared automation log ${logId}`);
    }
}

export const automationService = new AutomationService();
