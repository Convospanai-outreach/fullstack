import { prisma } from "@/lib/db";
import { JobPayload, JobQueue } from "@/lib/queue";
import { executeCampaign } from "./handlers/campaign-worker";
import { handleLeadEnrichment } from "./handlers/enrichment-worker";
import { handleEmailSend } from "./handlers/email-worker";
import { handleLinkedInScrape } from "./handlers/linkedin-worker";
import { handleAgentRun } from "./handlers/agent-worker";
import { handleCsvImport } from "./handlers/csv-worker";
import { handleIntelFollowupRefresh } from "./handlers/intel-followup-worker";
import { handleSequenceExecution } from "./handlers/sequence-worker";
import { handleGmailHistorySync } from "./handlers/gmail-history-sync-worker";

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

        case "INBOX_SYNC":
            return handleGmailHistorySync(payload);

        default:
            throw new Error(`No worker handler registered for job type ${jobType}`);
    }
}

export const worker = {
    async performJob(jobId: string) {
        const job = await prisma.job.findUnique({ where: { id: jobId } });
        if (!job) {
            throw new Error(`Job ${jobId} not found`);
        }

        const payload = ((job.payload || {}) as JobPayload);

        try {
            const result = await runHandler(job.type, payload);
            await JobQueue.complete(job.id, result || {});
            return result;
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown worker execution error";
            await JobQueue.fail(job.id, message);
            throw error;
        }
    },
};
