import { JobQueue } from "@/lib/queue";
import { executeCampaign } from "./handlers/campaign-worker";
import { handleLeadEnrichment } from "./handlers/enrichment-worker";
import { handleEmailSend } from "./handlers/email-worker";
import { handleLinkedInScrape } from "./handlers/linkedin-worker";
import { handleCsvImport } from "./handlers/csv-worker";
import { handleSequenceAction } from "./handlers/sequenceHandlers";
import { handleLinkedInAction } from "./handlers/linkedin";
import { WorkflowService } from "@/lib/workflowService";
import { EventStore } from "@/modules/learning/EventStore";
import { exportService } from "@/modules/data-export/service/exportService";

/**
 * Worker process that polls for jobs and executes them
 */
import { logger, logWorker } from "@/lib/logger";

/**
 * Worker process that polls for jobs and executes them
 */
export class WorkerManager {
    private isRunning = false;
    private pollInterval = 2000; // 2 seconds
    private pollTimer: NodeJS.Timeout | null = null;

    async start() {
        logger.info("Worker manager starting...", { category: 'system' });
        this.isRunning = true;
        this.poll();
    }

    async stop() {
        logger.info("Worker manager stopping...", { category: 'system' });
        this.isRunning = false;
        if (this.pollTimer) {
            clearTimeout(this.pollTimer);
            this.pollTimer = null;
        }
    }

    private async poll() {
        if (!this.isRunning) return;

        try {
            const job = await JobQueue.dequeue();

            if (job) {
                logWorker(job.id, "Processing", { type: job.type });
                await this.executeJob(job);
            }
        } catch (error) {
            logger.error("Error polling for jobs", { error });
        }

        // Schedule next poll
        this.pollTimer = setTimeout(() => this.poll(), this.pollInterval);
    }

    private async executeJob(job: any) {
        try {
            let result: any;

            switch (job.type) {
                case "campaign_execution":
                    result = await executeCampaign(job.payload.campaignId, job.payload.userId);
                    break;
                case "lead_enrichment":
                    result = await handleLeadEnrichment(job.payload);
                    break;
                case "email_send":
                case "email_sending":
                    result = await handleEmailSend(job.payload);
                    break;
                case "linkedin_scrape":
                case "linkedin_scraping":
                    result = await handleLinkedInScrape(job.payload);
                    break;
                case "csv_import":
                case "CSV_IMPORT":
                    result = await handleCsvImport(job.payload);
                    break;
                case "workflow_step":
                    if (!job.payload.runId || !job.payload.nodeId) {
                        throw new Error("Missing runId or nodeId for workflow_step");
                    }
                    await WorkflowService.processNode(job.payload.runId, job.payload.nodeId);
                    result = { success: true };
                    break;
                case "event_processing":
                    if (!job.payload.eventId) throw new Error("Missing eventId for event_processing");
                    await EventStore.processEventJob(job.payload.eventId);
                    result = { success: true };
                    break;
                case "SEQUENCE_ACTION":
                    result = await handleSequenceAction(job.payload);
                    break;
                case "LINKEDIN_ACTION":
                    result = await handleLinkedInAction({
                        action: job.payload.action || "VISIT_PROFILE",
                        profileUrl: job.payload.url,
                        message: job.payload.message,
                        cookies: job.payload.cookies
                    } as any);
                    break;
                case "agent_run": {
                    const { prisma } = await import("@/lib/db");
                    if (!job.payload.agentId) throw new Error("Missing agentId");
                    await prisma.agent.update({
                        where: { id: job.payload.agentId },
                        data: { status: "running" }
                    });
                    result = { success: true };
                    break;
                }
                case "agent_stop": {
                    const { prisma } = await import("@/lib/db");
                    if (!job.payload.agentId) throw new Error("Missing agentId");
                    await prisma.agent.update({
                        where: { id: job.payload.agentId },
                        data: { status: "idle" }
                    });
                    result = { success: true };
                    break;
                }
                case "data_export": {
                    const { entity, filters, teamId, userId } = job.payload;
                    if (!entity) throw new Error("Missing entity for export");
                    let effectiveTeamId = teamId;
                    if (!effectiveTeamId && userId) {
                        const { prisma } = await import("@/lib/db");
                        const member = await prisma.teamMember.findFirst({
                            where: { userId },
                            select: { teamId: true }
                        });
                        effectiveTeamId = member?.teamId ?? undefined;
                    }
                    if (!effectiveTeamId) throw new Error("Missing teamId for export");
                    if (filters?.format === "json") {
                        const json = await exportService.generateJson(entity, effectiveTeamId);
                        result = { success: true, json };
                    } else {
                        const csv = await exportService.generateCsv(entity, effectiveTeamId);
                        result = { success: true, csv };
                    }
                    break;
                }
                case "INBOX_SYNC":
                case "CRM_SYNC":
                    result = { success: true, skipped: true };
                    break;
                case "WEBHOOK_DISPATCH":
                    const { webhookService } = await import("@/modules/webhooks/service/webhookService");
                    await webhookService.processDelivery(job.payload.webhookId, job.payload.event, job.payload.payload);
                    result = { success: true };
                    break;
                default:
                    logger.warn(`Unknown job type: ${job.type}. Skipping.`, { jobId: job.id });
                    await JobQueue.complete(job.id, { skipped: true, reason: "unknown_type" });
                    return;
            }

            await JobQueue.complete(job.id, result);

            // Success: Reset consecutive failures for the campaign
            if (job.payload.campaignId) {
                await this.resetCampaignFailures(job.payload.campaignId);
            }

            logWorker(job.id, "Completed successfully");
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : "Unknown error";

            logWorker(job.id, "Failed", { error: errorMessage });

            // JobQueue.fail handles retries internally based on maxAttempts
            await JobQueue.fail(job.id, errorMessage);

            // Failure: Increment campaign consecutive failures
            if (job.payload.campaignId) {
                await this.handleCampaignFailure(job.payload.campaignId, errorMessage);
            }
        }
    }

    private async resetCampaignFailures(campaignId: string) {
        try {
            // Optimisation: only update if needed could be done, but simple update is fine
            // We use updateMany to avoid error if campaign doesn't exist (though it should)
            await import("@/lib/db").then(({ prisma }) =>
                prisma.campaign.update({
                    where: { id: campaignId },
                    data: { consecutiveFailures: 0 }
                })
            ).catch(() => { }); // Ignore errors if campaign deleted
        } catch (e) { /* silent */ }
    }

    private async handleCampaignFailure(campaignId: string, _error: string) {
        try {
            const { prisma } = await import("@/lib/db");
            const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });

            if (campaign) {
                const newCount = campaign.consecutiveFailures + 1;

                // Threshold: 5 failures
                if (newCount >= 5 && campaign.status === 'active') {
                    logger.warn(`Pausing campaign ${campaignId} due to ${newCount} consecutive failures.`, { campaignId });
                    await prisma.campaign.update({
                        where: { id: campaignId },
                        data: {
                            consecutiveFailures: newCount,
                            status: "paused"
                        }
                    });

                    // Notify user/team (Notification logic would go here)
                    // For now, we rely on the paused status being visible
                } else {
                    await prisma.campaign.update({
                        where: { id: campaignId },
                        data: { consecutiveFailures: newCount }
                    });
                }
            }
        } catch (e) {
            logger.error("Error updating campaign failure count:", { error: e, campaignId });
        }
    }
}
