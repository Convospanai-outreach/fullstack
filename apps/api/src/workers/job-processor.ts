import { prisma } from "@/lib/db";
import { JobClaim, JobClaimLostError, JobPayload, JobQueue } from "@/lib/queue";
import { executeCampaign } from "./handlers/campaign-worker";
import { handleLeadEnrichment } from "./handlers/enrichment-worker";
import { handleEmailSend } from "./handlers/email-worker";
import { handleLinkedInScrape } from "./handlers/linkedin-worker";
import { handleAgentRun } from "./handlers/agent-worker";
import { handleCsvImport } from "./handlers/csv-worker";
import { handleIntelFollowupRefresh } from "./handlers/intel-followup-worker";
import { handleSequenceExecution } from "./handlers/sequence-worker";
import { handleSequenceAction } from "./handlers/sequenceHandlers";
import { handleGmailHistorySync } from "./handlers/gmail-history-sync-worker";
import { GmailMailboxLeaseContendedError } from "@/modules/email-campaigner/service/googleMailboxService";
import { WorkflowService } from "@/lib/workflowService";
import { AuditService } from "@/modules/audit/auditService";

function asString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

async function runHandler(jobType: string, payload: JobPayload) {
    switch (jobType) {
        case "campaign_execution": {
            const campaignId = asString(payload.campaignId);
            if (!campaignId) {
                throw new Error("campaign_execution payload is missing campaignId");
            }
            return executeCampaign(campaignId, asString(payload.userId));
        }

        case "lead_enrichment":
            return handleLeadEnrichment(payload);

        case "email_sending":
            return handleEmailSend(payload);

        case "linkedin_scraping":
        case "LINKEDIN_ACTION": {
            const profileUrl = asString(payload.profileUrl) || asString(payload.url);
            if (!profileUrl) {
                throw new Error(`${jobType} payload is missing profileUrl/url`);
            }
            return handleLinkedInScrape({
                profileUrl,
                action: asString(payload.action),
                leadId: asString(payload.leadId),
                teamId: asString(payload.teamId),
            });
        }

        case "agent_run":
            return handleAgentRun(payload);

        case "lead_scoring": {
            const teamId = asString(payload.teamId);
            if (!teamId) {
                throw new Error("lead_scoring payload is missing teamId");
            }
            const { LeadScoringService } = await import("@/modules/scoring/service/LeadScoringService");
            return LeadScoringService.batchScoreLeads(teamId);
        }

        case "CSV_IMPORT": {
            const filePath = asString(payload.filePath);
            if (!filePath) {
                throw new Error("CSV_IMPORT payload is missing filePath");
            }
            return handleCsvImport({
                filePath,
                originalFilename: asString(payload.originalFilename),
                teamId: asString(payload.teamId),
            });
        }

        case "INTEL_FOLLOWUP_REFRESH":
            return handleIntelFollowupRefresh(payload as any);

        case "sequence_execution":
            return handleSequenceExecution(payload);

        case "SEQUENCE_ACTION":
            return handleSequenceAction(payload);

        case "INBOX_SYNC":
            return handleGmailHistorySync(payload);

        case "workflow_step": {
            // Two producers share this job type: WorkflowService.enqueueNodeProcessing
            // (runId/nodeId — a real workflow-builder run advancing one node) and
            // OutboxService.mapEventToJob's PAYMENT_CAPTURED case (eventType-tagged,
            // no runId/nodeId — a downstream signal with no consumer wired yet).
            const runId = asString(payload.runId);
            const nodeId = asString(payload.nodeId);
            if (runId && nodeId) {
                return WorkflowService.processNode(runId, nodeId);
            }

            const eventType = asString((payload as any).eventType);
            if (eventType) {
                const teamId = asString(payload.teamId);
                if (teamId) {
                    await AuditService.log(
                        teamId,
                        null,
                        eventType,
                        "OutboxEvent",
                        asString((payload as any).paymentId) || null,
                        payload
                    );
                }
                return { acknowledged: true, eventType };
            }

            throw new Error("workflow_step payload is missing runId/nodeId and eventType");
        }

        case "order_captured": {
            // No publisher yet — OutboxService.mapEventToJob wires ORDER_CAPTURED
            // events here ahead of the checkout/order model that will emit them.
            // Recorded as an audit trail until a real downstream action (sequence
            // enrollment, course-access grant) is scoped.
            const teamId = asString(payload.teamId);
            if (!teamId) {
                throw new Error("order_captured payload is missing teamId");
            }
            await AuditService.log(
                teamId,
                null,
                "ORDER_CAPTURED",
                "Order",
                asString((payload as any).orderId) || null,
                payload
            );
            return { acknowledged: true };
        }

        default:
            throw new Error(`No worker handler registered for job type ${jobType}`);
    }
}

export const worker = {
    async performJob(claim: JobClaim) {
        const job = await prisma.job.findFirst({
            where: {
                id: claim.jobId,
                status: "running",
                version: claim.version,
            },
        });
        if (!job) {
            throw new JobClaimLostError(claim.jobId);
        }

        const payload = ((job.payload || {}) as JobPayload);

        let result: unknown;
        try {
            await JobQueue.assertClaim(claim.jobId, claim.version);
            result = await runHandler(job.type, payload);
        } catch (error) {
            if (error instanceof GmailMailboxLeaseContendedError) {
                const delayMs = 15_000 + Math.floor(Math.random() * 30_001);
                await JobQueue.defer(claim.jobId, claim.version, {
                    processAt: new Date(Date.now() + delayMs),
                    reason: "MAILBOX_LEASE_CONTENDED",
                });
                return { deferred: true, reason: "MAILBOX_LEASE_CONTENDED" };
            }
            const message = error instanceof Error ? error.message : "Unknown worker execution error";
            if (error instanceof JobClaimLostError) {
                throw error;
            }
            await JobQueue.fail(claim.jobId, claim.version, message);
            throw error;
        }

        // Completion persistence is intentionally separate from business work.
        // A completed handler must never be requeued merely because final state
        // persistence failed; version-fenced watchdog recovery handles that claim.
        await JobQueue.complete(claim.jobId, claim.version, result || {});
        return result;
    },
};
