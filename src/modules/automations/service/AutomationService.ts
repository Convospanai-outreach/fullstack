import { prisma } from "@/lib/db";

export type TriggerType = "lead.replied" | "email.opened" | "ai.suggestion";
export type ActionType = "campaign.stop" | "email.reply" | "lead.tag" | "webhook.call";

class AutomationService {
    /**
     * Evaluates automations for a given trigger.
     * @param teamId Team ID
     * @param trigger Trigger Name
     * @param context Data contextual to the event (e.g. Lead ID, Campaign ID)
     */
    async evaluate(teamId: string, trigger: TriggerType, context: any) {
        // 1. Fetch active automations for this team & trigger
        const activeAutomations = await prisma.automation.findMany({
            where: { teamId, trigger, isActive: true }
        });

        if (activeAutomations.length === 0) return;

        for (const automation of activeAutomations) {
            await this.processAutomation(automation, context);
        }
    }

    private async processAutomation(automation: any, context: any) {
        // 2. Check for Manual Intervention (Human-in-the-Loop)
        if (automation.requiresApproval) {
            await prisma.automationLog.create({
                data: {
                    automationId: automation.id,
                    status: "pending_approval",
                    output: context, // Store context so user can review what triggered this
                    tokensUsed: 0,
                    cost: 0
                }
            });
            // TODO: Notify user 
            return;
        }

        // 3. Execute Action Immediately
        await this.executeAction(automation, context);
    }

    private async executeAction(automation: any, context: any) {
        let status = "success";
        let output = {};
        let tokens = 0;

        try {
            switch (automation.action as ActionType) {
                case "campaign.stop":
                    if (context.campaignId && context.email) {
                        // Stop logic here (e.g. remove from queue or update status)
                        // For MVP: Just log it as we don't have a "Leads in Campaign" table explicitly other than Lead.campaignId
                        // We might set Lead status?
                        await prisma.lead.updateMany({
                            where: { id: context.leadId },
                            data: { status: "STOPPED" } // Simplify
                        });
                        output = { message: "Campaign stopped for lead" };
                    }
                    break;

                case "email.reply":
                    // AI Generation Logic would go here
                    // e.g. generate reply using context.message
                    // For now, simulate:
                    output = { draft: "Simulated AI Reply based on " + context.message };
                    tokens = 150;
                    break;

                case "webhook.call":
                    if (automation.config?.url) {
                        await fetch(automation.config.url, {
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
        } catch (error: any) {
            status = "failed";
            output = { error: error.message };
            console.error(`Automation ${automation.id} failed:`, error);
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
        await this.executeAction(log.automation, log.output); // Use stored context

        // Update old log status? Or just leave it as 'pending_approval' (historical)?
        // Better to update it to "approved" or delete it?
        // Let's update it to "approved" so it disappears from queue
        await prisma.automationLog.update({
            where: { id: logId },
            data: { status: "approved" }
        });
    }
}

export const automationService = new AutomationService();
