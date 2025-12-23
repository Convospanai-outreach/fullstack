import { JobQueue } from "@/lib/queue";
import { handleLikePost, handleCommentPost, handleScrapeProfile } from "./handlers/linkedinHandlers";
import { handleSmartComment, handleSmartConnect } from "./handlers/aiHandlers";
import { handleSequenceAction } from "./handlers/sequenceHandlers";
import { handleEmailSend } from "./handlers/emailHandlers";

const POLL_INTERVAL = 5000; // 5 seconds

async function processJob(job: any) {
    console.log(`Processing job ${job.id} (${job.type})...`);
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
            default:
                throw new Error(`Unknown job type: ${job.type}`);
        }

        if (result.ok) {
            await JobQueue.complete(job.id, result);
            console.log(`Job ${job.id} completed.`);
        } else {
            throw new Error(result.error || "Unknown error");
        }
    } catch (error: any) {
        console.error(`Job ${job.id} failed:`, error.message);
        await JobQueue.fail(job.id, error.message);
    }
}

export async function startWorker() {
    console.log("Worker started. Polling for jobs...");

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
            console.error("Worker error:", error);
            await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
        }
    }
}

// Allow running directly
if (require.main === module) {
    startWorker();
}
