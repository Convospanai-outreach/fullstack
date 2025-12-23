import { JobQueue } from "@/lib/queue";
import { executeCampaign } from "./handlers/campaign-worker";
import { handleLeadEnrichment } from "./handlers/enrichment-worker";
import { handleEmailSend } from "./handlers/email-worker";
import { handleLinkedInScrape } from "./handlers/linkedin-worker";
import { handleCsvImport } from "./handlers/csv-worker";

/**
 * Worker process that polls for jobs and executes them
 */
export class WorkerManager {
    private isRunning = false;
    private pollInterval = 2000; // 2 seconds
    private pollTimer: NodeJS.Timeout | null = null;

    async start() {
        console.log("🚀 Worker manager starting...");
        this.isRunning = true;
        this.poll();
    }

    async stop() {
        console.log("🛑 Worker manager stopping...");
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
                console.log(`📋 Processing job ${job.id} (${job.type})`);
                await this.executeJob(job);
            }
        } catch (error) {
            console.error("Error polling for jobs:", error);
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
                    result = await handleEmailSend(job.payload);
                    break;
                case "linkedin_scrape":
                case "linkedin_scraping":
                    result = await handleLinkedInScrape(job.payload);
                    break;
                case "csv_import":
                    result = await handleCsvImport(job.payload);
                    break;
                case "WEBHOOK_DISPATCH":
                    const { webhookService } = await import("@/modules/webhooks/service/webhookService");
                    await webhookService.processDelivery(job.payload.webhookId, job.payload.event, job.payload.payload);
                    result = { success: true };
                    break;
                default:
                    console.warn(`Unknown job type: ${job.type}. Skipping.`);
                    await JobQueue.complete(job.id, { skipped: true, reason: "unknown_type" });
                    return;
            }

            await JobQueue.complete(job.id, result);
            console.log(`✅ Job ${job.id} completed successfully`);
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : "Unknown error";
            console.error(`❌ Job ${job.id} failed:`, errorMessage);

            // JobQueue.fail handles retries internally based on maxAttempts
            await JobQueue.fail(job.id, errorMessage);
        }
    }
}
