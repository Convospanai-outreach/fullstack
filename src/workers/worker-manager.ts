import { dequeueJob, updateJobStatus } from "./job-queue";
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
            const job = await dequeueJob();

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
                    result = await executeCampaign(job.payload.campaignId);
                    break;
                case "lead_enrichment":
                    result = await handleLeadEnrichment(job.payload);
                    break;
                case "email_send":
                    result = await handleEmailSend(job.payload);
                    break;
                case "linkedin_scrape":
                    result = await handleLinkedInScrape(job.payload);
                    break;
                case "csv_import":
                    result = await handleCsvImport(job.payload);
                    break;
                default:
                    throw new Error(`Unknown job type: ${job.type}`);
            }

            await updateJobStatus(job.id, "completed", result);
            console.log(`✅ Job ${job.id} completed successfully`);
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : "Unknown error";
            console.error(`❌ Job ${job.id} failed:`, errorMessage);

            // Check if we should retry
            if (job.attempts < job.maxAttempts) {
                console.log(
                    `🔄 Job ${job.id} will be retried (attempt ${job.attempts}/${job.maxAttempts})`
                );
                await updateJobStatus(job.id, "pending", undefined, errorMessage);
            } else {
                await updateJobStatus(job.id, "failed", undefined, errorMessage);
            }
        }
    }
}
