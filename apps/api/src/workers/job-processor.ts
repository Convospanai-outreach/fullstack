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
import { handleLandingLeadIntake } from "./handlers/landing-lead-intake-worker";
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
            const { leadScoringService } = await import("@/modules/scoring/service/LeadScoringService");
            return leadScoringService.batchScoreLeads(teamId);
        }

        case "landing_lead_intake":
            return handleLandingLeadIntake(payload);

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

        case "warmup_seed_reply": {
            const { sendWarmupSeedReply } = await import("@/modules/email-campaigner/service/warmupSeedService");
            return sendWarmupSeedReply(payload);
        }

        case "agent_stop": {
            // The real stop action (Agent.status -> "idle", an Activity row, and
            // an audit() call) already happens synchronously in
            // routes/orchestrator/agents/[id]/stop before this job is enqueued —
            // this job is an async completion signal only, no further state
            // change needed. Kept as its own case (rather than falling into
            // default) so it doesn't throw.
            return { acknowledged: true, agentId: asString(payload.agentId) };
        }

        case "data_export": {
            const teamId = asString(payload.teamId);
            const entity = asString(payload.entity);
            if (!teamId || !entity) {
                throw new Error("data_export payload is missing teamId/entity");
            }
            if (entity !== "leads" && entity !== "campaigns") {
                throw new Error(`data_export does not support entity type "${entity}"`);
            }
            const { exportService } = await import("@/modules/data-export/service/exportService");
            const csv = await exportService.generateCsv(entity, teamId);
            return { entity, format: "csv", csv };
        }

        case "CRM_SYNC": {
            const teamId = asString(payload.teamId);
            if (!teamId) {
                throw new Error("CRM_SYNC payload is missing teamId");
            }
            const config = await prisma.crmIntegration.findUnique({
                where: { teamId_provider: { teamId, provider: "HUBSPOT" } },
            });
            if (!config || !config.isActive) {
                return { syncedCount: 0, skipped: "HubSpot not configured or inactive" };
            }
            const { crmService } = await import("@/modules/crm-integration/service/crmService");
            const leads = await prisma.lead.findMany({
                where: { teamId, email: { not: null } },
                select: { id: true },
                take: 500,
            });
            const summary: Record<string, number> = {};
            for (const lead of leads) {
                const result = await crmService.syncLead(lead.id, teamId);
                summary[result.status] = (summary[result.status] || 0) + 1;
            }
            return { syncedCount: leads.length, summary };
        }

        case "WEBHOOK_DISPATCH": {
            const webhookId = asString(payload.webhookId);
            const event = asString(payload.event);
            if (!webhookId || !event) {
                throw new Error("WEBHOOK_DISPATCH payload is missing webhookId/event");
            }
            const { webhookService } = await import("@/modules/webhooks/service/webhookService");
            return webhookService.processDelivery(webhookId, event, (payload as any).payload || {});
        }

        case "event_processing": {
            const eventId = asString((payload as any).eventId);
            if (eventId) {
                const { EventStore } = await import("@/modules/learning/EventStore");
                await EventStore.processEventJob(eventId);
                return { acknowledged: true, eventId };
            }

            // Generic fallback for outbox events without a specific job-type
            // mapping yet (OutboxService.mapEventToJob's default branch) — same
            // audit-trail pattern as the order_captured case above.
            const teamId = asString(payload.teamId);
            const eventType = asString((payload as any).eventType);
            if (teamId && eventType) {
                await AuditService.log(
                    teamId,
                    null,
                    eventType,
                    asString((payload as any).aggregateType) || "OutboxEvent",
                    asString((payload as any).aggregateId) || null,
                    payload
                );
                return { acknowledged: true, eventType };
            }

            throw new Error("event_processing payload is missing eventId or teamId/eventType");
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
