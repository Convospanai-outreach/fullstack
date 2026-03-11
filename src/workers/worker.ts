import { JobQueue } from "@/lib/queue";
import { handleLikePost, handleCommentPost, handleScrapeProfile } from "./handlers/linkedinHandlers";
import { handleSmartComment, handleSmartConnect } from "./handlers/aiHandlers";
import { handleSequenceAction } from "./handlers/sequenceHandlers";
import { handleEmailSend } from "./handlers/emailHandlers";
import { EventStore } from "@/modules/learning/EventStore";
import { dataIngestionService } from "@/modules/learning/DataIngestionService";
import { logger } from "@/lib/logger";
import { RequestContext } from "@/lib/requestContext";

const POLL_INTERVAL = 5000; // 5 seconds

function logWorker(jobId: string, status: string, meta: any = {}) {
    logger.info(`[Worker] Job ${jobId}: ${status}`, {
        jobId,
        status,
        ...meta,
        category: 'worker'
    });
}

async function processJob(job: any) {
    const correlationId = job.payload?.correlationId || `job-${job.id}`;

    return await RequestContext.run({ correlationId }, async () => {
        logWorker(job.id, "Processing started", { type: job.type, correlationId });
        try {
        let result;
        switch (job.type) {
            case "LINKEDIN_LIKE":
                result = await handleLikePost(job.payload);
                break;
            case "LINKEDIN_COMMENT":
                result = await handleCommentPost(job.payload);
                break;
            case "LINKEDIN_SCRAPE":
                result = await handleScrapeProfile(job.payload);
                break;
            case "SMART_COMMENT":
                result = await handleSmartComment(job.payload);
                break;
            case "SMART_CONNECT":
                result = await handleSmartConnect(job.payload);
                break;
            case "SEQUENCE_ACTION":
                result = await handleSequenceAction(job.payload);
                break;
            case "email_send": // Matching the JobType enum case
                result = await handleEmailSend(job.payload);
                break;
            case "event_processing":
                await EventStore.processEventJob(job.payload.eventId);
                result = { ok: true };
                break;
            case "lead_enrichment":
                await dataIngestionService.processEnrichmentJob(
                    job.payload.leadId,
                    job.payload.teamId,
                    job.payload.campaignId,
                    job.payload.extraction
                );
                result = { ok: true };
                break;

            case "CSV_IMPORT":
                if (job.payload.filePath && job.payload.teamId) {
                    await dataIngestionService.processFileUpload(
                        job.payload.teamId,
                        job.payload.filePath,
                        job.payload.campaignId
                    );
                    // Cleanup temp file
                    const fs = require('fs/promises');
                    await fs.unlink(job.payload.filePath).catch((e: any) => console.error("Failed to delete temp file", e));
                    result = { ok: true, processed: true };
                } else {
                    throw new Error("Missing filePath or teamId for CSV_IMPORT");
                }
                break;
            default:
                throw new Error(`Unknown job type: ${job.type}`);
        }

        const res = result as any;
        const isSuccess = result === true || (res && (res.ok === true || res.success === true || res.processed === true));

        if (isSuccess) {
            await JobQueue.complete(job.id, result);
            logWorker(job.id, "Completed successfully");
        } else {
            throw new Error((res && res.error) || "Unknown error or failed result");
        }
    } catch (error: any) {
        logWorker(job.id, "Failed", { error: error.message });
        await JobQueue.fail(job.id, error.message);
    }
    }); // End RequestContext
}

export async function startWorker() {
    logger.info("Worker started. Polling for jobs...", { category: 'system' });

    while (true) {
        try {
            const job = await JobQueue.dequeue();
            if (job) {
                await processJob(job);
            } else {
                // No jobs, wait before next poll
                await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
            }
        } catch (error) {
            logger.error("Worker error loop", { error });
            await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
        }
    }
}

// Allow running directly
if (require.main === module) {
    startWorker();
}
