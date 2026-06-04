import { JobQueue } from '@/lib/queue';
import type { Job } from '@prisma/client';

import { handleLeadEnrichment } from "./handlers/enrichment-worker";
import { handleEmailSending } from "./handlers/email-sending-worker";
import { handleCampaignExecution } from "./handlers/campaign-execution-worker";
import { handleSequenceStep } from "./handlers/sequence-step-worker";
import { logger } from "@/lib/logger";

// KNOWN_JOB_TYPES: [ "email_sending", "workflow_step", "WEBHOOK_DISPATCH", "event_processing", "linkedin_scraping", "CSV_IMPORT", "SEQUENCE_ACTION", "lead_enrichment", "campaign_execution", "sequence_step" ]
// Simple dispatcher – expand as needed
export async function dispatch(job: Job) {
  logger.info(`[worker] dispatching job`, { jobId: job.id, type: job.type });
  
  switch (job.type) {
    case "lead_enrichment":
      return handleLeadEnrichment(job.payload as any);
    case "email_sending":
      return handleEmailSending(job.payload as any);
    case "campaign_execution":
      return handleCampaignExecution(job.payload as any);
    case "sequence_step":
      return handleSequenceStep(job.payload as any);

    // Acknowledged but not yet implemented – dead-letter for manual review
    case "workflow_step":
    case "WEBHOOK_DISPATCH":
    case "event_processing":
    case "linkedin_scraping":
    case "CSV_IMPORT":
    case "SEQUENCE_ACTION":
      logger.warn(`[worker] job type not yet implemented, dead-lettering`, { jobId: job.id, type: job.type });
      await JobQueue.fail(job.id, `Handler not implemented for job type: ${job.type}`);
      return;

    default:
      logger.error(`[worker] completely unknown job type, dead-lettering`, { jobId: job.id, type: job.type });
      await JobQueue.fail(job.id, `Unknown job type: ${job.type}`);
      return;
  }
}

/* v8 ignore start -- infinite process loop is exercised by worker smoke/runtime checks, not unit coverage */
async function runWorker() {
  // Reset any stale jobs that may have been left running
  await JobQueue.resetStaleJobs();
  logger.info('[worker] started');
  while (true) {
    const job = await JobQueue.dequeue();
    if (job) {
      try {
        await dispatch(job);
        // Mark completed only if dispatch didn't already dead-letter
        if (!["workflow_step", "WEBHOOK_DISPATCH", "event_processing", "linkedin_scraping", "CSV_IMPORT", "SEQUENCE_ACTION"].includes(job.type)) {
          await JobQueue.complete(job.id);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`[worker] job failed`, { jobId: job.id, type: job.type, error: message });
        try {
          await JobQueue.fail(job.id, message);
        } catch (failErr) {
          logger.error(`[worker] could not record failure`, { jobId: job.id, error: failErr });
        }
      }
    } else {
      // idle wait – avoid tight loop
      await new Promise(res => setTimeout(res, 2000));
    }
  }
}

// Only start when this file is executed directly (e.g., via `node`)
if (require.main === module) {
  runWorker().catch(err => {
    logger.error('[worker] fatal error:', { error: err });
    process.exit(1);
  });
}
/* v8 ignore stop */
