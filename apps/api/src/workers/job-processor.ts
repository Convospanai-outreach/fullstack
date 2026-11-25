import { prisma } from "@/lib/db";
import { JobClaim, JobClaimLostError, JobPayload, JobQueue, NonRetryableJobError } from "@/lib/queue";
import { executeCampaign } from "./handlers/campaign-worker";
import { handleLeadEnrichment } from "./handlers/enrichment-worker";
import { handleEmailSend } from "./handlers/email-worker";
import { handleLinkedInScrape } from "./handlers/linkedin-worker";
import { handleAgentRun } from "./handlers/agent-worker";
import { handleCsvImport } from "./handlers/csv-worker";
import { handleIntelFollowupRefresh } from "./handlers/intel-followup-worker";
import { handleSequenceExecution } from "./handlers/sequence-worker";
import { handleSequenceAction } from "./handlers/sequenceHandlers";
import { handleEmailDraftBatchSubmit, handleEmailDraftBatchPoll } from "./handlers/emailDraftBatchHandlers";
import { handleGmailHistorySync } from "./handlers/gmail-history-sync-worker";
import { handleLandingLeadIntake } from "./handlers/landing-lead-intake-worker";
import { handleMetaCapiLead } from "./handlers/meta-capi-worker";
import { handleInvoicePdfRender } from "./handlers/invoicePdfWorker";
import { GmailMailboxLeaseContendedError } from "@/modules/email-campaigner/service/googleMailboxService";
import { WorkflowService } from "@/lib/workflowService";
import { AuditService } from "@/modules/audit/auditService";
import { captureException } from "@/lib/sentry";

function asString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

async function runHandler(jobType: string, payload: JobPayload, claim: JobClaim) {
    switch (jobType) {
        case "mailbox_reputation_check": {
            const teamId = asString(payload.teamId);
            const mailboxId = asString(payload.mailboxId);
            if (!teamId || !mailboxId) throw new NonRetryableJobError("Missing mailbox reputation scope");
            const { evaluateMailboxReputation } = await import("@/modules/overseer/mailboxReputation");
            return { checked: Boolean(await evaluateMailboxReputation(teamId, mailboxId, new Date(), "webhook")) };
        }
        case "reply_subsequence_inbound": {
            const messageId = asString(payload.messageId);
            if (!messageId) throw new NonRetryableJobError("Invalid inbound follow-up trigger");
            const whatsApp = payload.source === "whatsapp" ? await prisma.whatsAppMessage.findFirst({
                where: { id: messageId, direction: "INBOUND" }, select: { id: true, leadId: true, body: true },
            }) : null;
            const message = payload.source === "whatsapp" ? (whatsApp ? { ...whatsApp, content: whatsApp.body } : null)
                : await prisma.message.findFirst({ where: { id: messageId, direction: "INBOUND" },
                    select: { id: true, leadId: true, content: true } });
            if (message) {
                const { reactToInboundReply } = await import("@/modules/inbox/replySubsequenceService");
                await reactToInboundReply(message);
            }
            return { checked: true };
        }
        case "reply_subsequence_notice": {
            const teamId = asString(payload.teamId), leadId = asString(payload.leadId), runId = asString(payload.runId);
            if (!teamId || !leadId || !runId || !Number.isInteger(payload.step) || !Number.isInteger(payload.revision)) {
                throw new NonRetryableJobError("Invalid follow-up notice");
            }
            const { sendReplySubsequenceNotice } = await import("@/modules/inbox/replySubsequenceService");
            await sendReplySubsequenceNotice({ teamId, leadId, runId, step: payload.step, revision: payload.revision });
            return { checked: true };
        }
        case "scheduled_inbox_reply": {
            if (payload.replySubsequence !== undefined) {
                const { runReplySubsequenceStep } = await import("@/modules/inbox/replySubsequenceWorker");
                return runReplySubsequenceStep(payload, claim);
            }
            const job = await prisma.job.findUnique({ where: { id: claim.jobId }, select: { teamId: true, expiresAt: true } });
            const userId = asString(payload.userId);
            const messageId = asString(payload.messageId);
            if (!job?.teamId || job.teamId !== payload.teamId || !userId || !messageId || !job.expiresAt) {
                throw new NonRetryableJobError("Invalid scheduled inbox reply");
            }
            const { resolveReplyFlowSettings } = await import("@/lib/replyFlowSettings");
            const team = await prisma.team.findUnique({ where: { id: job.teamId }, select: { sendSafety: true } });
            const settings = resolveReplyFlowSettings(team?.sendSafety);
            if (!settings.scheduledReplies || (payload.delayHours !== undefined && !settings.delayChoices.includes(payload.delayHours))) {
                return { skipped: "scheduled_replies_disabled" };
            }
            if (job.expiresAt.getTime() <= Date.now()) return { skipped: "expired" };
            const member = await prisma.teamMember.findFirst({ where: { teamId: job.teamId, userId, status: "active" }, select: { id: true } });
            if (!member) return { skipped: "sender_no_longer_on_team" };
            const { decryptCredential } = await import("@/lib/security/credentialVault");
            const approvedReply = JSON.parse(await decryptCredential(payload.approvedReply) ?? "null") as { content?: unknown; recipient?: unknown } | null;
            const content = asString(approvedReply?.content);
            const expectedRecipient = asString(approvedReply?.recipient);
            if (!content || content.length > 2200 || !expectedRecipient) throw new NonRetryableJobError("Invalid approved reply content");
            const { sendReply } = await import("@/modules/inbox/actionInboxService");
            await sendReply({ teamId: job.teamId, userId, messageId, content, scheduledJobId: claim.jobId, expectedRecipient });
            return { sent: true };
        }
        case "campaign_execution": {
            const campaignId = asString(payload.campaignId);
            if (!campaignId) {
                throw new Error("campaign_execution payload is missing campaignId");
            }
            return executeCampaign(campaignId, asString(payload.userId), asString(payload.teamId));
        }

        case "lead_enrichment":
            return handleLeadEnrichment(payload);

        case "email_sending":
            return handleEmailSend(payload, claim.jobId);

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

        case "lead_rescore": {
            const leadId = asString(payload.leadId);
            if (!leadId) {
                throw new Error("lead_rescore payload is missing leadId");
            }
            const { leadScoringService } = await import("@/modules/scoring/service/LeadScoringService");
            return leadScoringService.scoreAndPersist(leadId);
        }

        case "landing_lead_intake":
            return handleLandingLeadIntake(payload);

        case "meta_capi_lead":
            return handleMetaCapiLead(payload);

        case "invoice_pdf_render":
            return handleInvoicePdfRender(payload);

        case "reply_classification": {
            const teamId = asString(payload.teamId);
            const messageId = asString(payload.messageId);
            if (!teamId || !messageId) {
                throw new NonRetryableJobError("reply_classification payload is missing teamId/messageId");
            }
            const { classifyInboundReplyOrFlag } = await import("@/modules/inbox/replyClassificationService");
            try {
                return await classifyInboundReplyOrFlag(teamId, messageId, claim.jobId);
            } catch (error) {
                // A team out of credits would fail identically on every retry.
                if (error instanceof Error && /insufficient credits/i.test(error.message)) {
                    throw new NonRetryableJobError(error.message);
                }
                throw error;
            }
        }

        case "whatsapp_reply_classification": {
            const teamId = asString(payload.teamId);
            const messageId = asString(payload.messageId);
            if (!teamId || !messageId) {
                throw new NonRetryableJobError("whatsapp_reply_classification payload is missing teamId/messageId");
            }
            const { classifyWhatsAppReply } = await import("@/modules/whatsapp/whatsappReplyClassification");
            return classifyWhatsAppReply(teamId, messageId);
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
            // Published by the Stripe Connect and Razorpay webhooks once a checkout order is
            // paid. Recorded as an audit trail, then the creator funnel hooks run for teams
            // with the flag on (POST stage, stop nurture, delivery email; never throws).
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
            const orderId = asString((payload as any).orderId);
            if (orderId) {
                const { onOrderCaptured } = await import("@/modules/creator-funnel/checkoutHooks");
                await onOrderCaptured(teamId, orderId);
            }
            return { acknowledged: true };
        }

        case "playbook_generate": {
            // Creator funnel playbook wizard: writes a plan's draft posts. Never throws (a failure
            // is recorded on the plan for a manual retry, since every AI call is billed).
            const runId = asString(payload.runId);
            if (!runId) {
                throw new NonRetryableJobError("playbook_generate payload is missing runId");
            }
            const { generatePlaybookRun } = await import("@/modules/creator-funnel/playbookWizard");
            return generatePlaybookRun(runId);
        }

        case "EMAIL_DRAFT_BATCH_SUBMIT":
            return handleEmailDraftBatchSubmit(payload);

        case "EMAIL_DRAFT_BATCH_POLL":
            return handleEmailDraftBatchPoll(payload);

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
            for (const [index, lead] of leads.entries()) {
                const result = await crmService.syncLead(lead.id, teamId);
                summary[result.status] = (summary[result.status] || 0) + 1;
                // Up to 500 sequential syncLead calls can run past the stale-job
                // watchdog's 15-minute threshold - heartbeat periodically so it
                // isn't falsely reclaimed and double-run by another worker.
                if (index > 0 && index % 25 === 0) {
                    await JobQueue.heartbeat(claim.jobId, claim.version);
                }
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
            return webhookService.processDelivery(webhookId, event, (payload as any).payload || {}, asString(payload.teamId));
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
            result = await runHandler(job.type, payload, claim);
            const hold = (result as { deferredSendingReason?: unknown } | null)?.deferredSendingReason;
            if (hold === "MAILBOX_REPUTATION_HOLD" || hold === "TEAM_SENDING_HOLD" || hold === "GROWTH_CAP") {
                await JobQueue.defer(claim.jobId, claim.version, {
                    processAt: new Date(Date.now() + 30 * 60_000 + Math.floor(Math.random() * 5 * 60_000)),
                    reason: hold,
                });
                return { deferred: true, reason: hold };
            }
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
            captureException(error);
            await JobQueue.fail(claim.jobId, claim.version, message, !(error instanceof NonRetryableJobError));
            throw error;
        }

        // Completion persistence is intentionally separate from business work.
        // A completed handler must never be requeued merely because final state
        // persistence failed; version-fenced watchdog recovery handles that claim.
        if (job.type === "scheduled_inbox_reply" && payload.replySubsequence !== undefined
            && (result as { replySubsequenceDeferred?: boolean } | undefined)?.replySubsequenceDeferred) return result;
        await JobQueue.complete(claim.jobId, claim.version, result || {});
        return result;
    },
};
