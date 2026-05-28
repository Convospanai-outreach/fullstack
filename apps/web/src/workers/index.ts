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
    default:
      logger.warn(`[worker] unknown job type: ${job.type}`, { jobId: job.id });
      throw new Error(`Unknown job type: ${job.type}`);
  }
}

async function runWorker() {
  // Reset any stale jobs that may have been left running
  await JobQueue.resetStaleJobs();
  logger.info('[worker] started');
  while (true) {
    const job = await JobQueue.dequeue();
    if (job) {
      await dispatch(job);
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
