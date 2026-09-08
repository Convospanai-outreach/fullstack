import { prisma } from "@/lib/db";
import { JobPayload, JobQueue } from "@/lib/queue";
import { logger } from "@/lib/logger";
import { submitBatch, pollBatch } from "@/lib/ai/batchDraftService";

const POLL_BACKOFF_MS = [5, 15, 30, 60].map((minutes) => minutes * 60 * 1000);
const MAX_POLL_ATTEMPTS = POLL_BACKOFF_MS.length;

export async function handleEmailDraftBatchSubmit(payload: JobPayload) {
    const { campaignId, teamId } = payload;
    if (!campaignId || !teamId) {
        throw new Error("EMAIL_DRAFT_BATCH_SUBMIT payload is missing campaignId/teamId");
    }

    const { batchId } = await submitBatch(campaignId, teamId);

    await JobQueue.enqueue(
        "EMAIL_DRAFT_BATCH_POLL",
        { campaignId, teamId, batchId },
        { processAt: new Date(Date.now() + POLL_BACKOFF_MS[0]), teamId }
    );

    return { batchId };
}

export async function handleEmailDraftBatchPoll(payload: JobPayload) {
    const { campaignId, teamId, batchId } = payload;
    if (!campaignId || !teamId || !batchId) {
        throw new Error("EMAIL_DRAFT_BATCH_POLL payload is missing campaignId/teamId/batchId");
    }

    const { ready } = await pollBatch(batchId);

    if (!ready) {
        const batch = await prisma.aiDraftBatch.findUnique({ where: { id: batchId } });
        const attempt = batch?.pollAttempts ?? 0;
        if (attempt >= MAX_POLL_ATTEMPTS) {
            logger.error(`[BatchDraft] Batch ${batchId} for campaign ${campaignId} did not complete after ${attempt} polls - giving up`);
            throw new Error(`AiDraftBatch ${batchId} did not complete within the polling window`);
        }
        const delay = POLL_BACKOFF_MS[Math.min(attempt, POLL_BACKOFF_MS.length - 1)];
        await JobQueue.enqueue(
            "EMAIL_DRAFT_BATCH_POLL",
            { campaignId, teamId, batchId },
            { processAt: new Date(Date.now() + delay), teamId }
        );
        return { deferred: true, nextPollInMs: delay };
    }

    const items = await prisma.aiDraftBatchItem.findMany({ where: { batchId } });

    for (const item of items) {
        const jobPayload: JobPayload = {
            leadId: item.leadId,
            campaignId,
            teamId,
            ...(item.status === "succeeded" ? { precomputedDraft: { subject: item.subject, body: item.body } } : {}),
        };
        await JobQueue.enqueue("email_sending", jobPayload, {
            teamId,
            idempotencyKey: `batch_send_${batchId}_${item.leadId}`,
        });
    }

    logger.info(`[BatchDraft] Batch ${batchId} for campaign ${campaignId} completed - enqueued ${items.length} send jobs`);

    return { batchId, itemsProcessed: items.length };
}
