
import { JobQueue } from "@/lib/queue";
import { prisma } from "@/lib/db";
import { executeCampaign } from "./handlers/campaign-worker";
import { deductCredits } from "../lib/credits";
import { handleLinkedInAction } from "./handlers/linkedin";
import { HubSpotService } from "@/lib/crm";

import { logger } from "@/lib/logger";

const POLLING_INTERVAL = 5000; // 5 seconds

logger.info("🚀 Worker process started...");

async function processNextJob() {
    try {
        const job = await JobQueue.dequeue();

        if (!job) {
            setTimeout(processNextJob, POLLING_INTERVAL);
            return;
        }

        logger.info(`Working on job ${job.id} (${job.type})`, { jobId: job.id, type: job.type });

        try {
            let result;

            switch (job.type) {
                case "campaign_execution":
                    // Credit Check: -5 credits
                    if (job.teamId) {
                        const hasCredits = await deductCredits(job.teamId, 5, "Campaign Execution", { jobId: job.id });
                        if (!hasCredits) throw new Error("Insufficient credits");
                    }
                    if (!job.payload || typeof job.payload !== 'object' || !('campaignId' in (job.payload as any))) {
                        throw new Error("Invalid payload for campaign_execution");
                    }
                    const { campaignId } = job.payload as { campaignId: string };
                    result = await executeCampaign(campaignId);
                    break;

                case "linkedin_action": // Maps to LINKEDIN_ACTION job type
                case "LINKEDIN_ACTION":
                    // Credit Check: -2 credits
                    if (job.teamId) {
                        const hasCredits = await deductCredits(job.teamId, 2, "LinkedIn Action", { jobId: job.id });
                        if (!hasCredits) throw new Error("Insufficient credits");
                    }
                    result = await handleLinkedInAction(job.payload as any);
                    break;

                case "data_export":
                    // Credit Check: -1 credit
                    if (job.teamId) {
                        const hasCredits = await deductCredits(job.teamId, 1, "Data Export", { jobId: job.id });
                        if (!hasCredits) throw new Error("Insufficient credits");
                    }
                    console.log("📂 Exporting data...");
                    const data = await prisma.campaign.findMany({ take: 100 });
                    const headers = ["id", "name", "status", "createdAt"];
                    const csvContent = [
                        headers.join(","),
                        ...data.map((c: any) => [c.id, c.name, c.status, c.createdAt].join(","))
                    ].join("\n");
                    const fs = require("fs");
                    const path = require("path");
                    const exportDir = path.join(process.cwd(), "storage", "exports");
                    if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });
                    const filename = `export_${Date.now()}.csv`;
                    fs.writeFileSync(path.join(exportDir, filename), csvContent);
                    result = { filename, url: `/api/exports/${filename}` };
                    break;



                // ... inside switch ...
                case "crm_sync":
                case "CRM_SYNC":
                    if (!job.payload || !job.teamId) throw new Error("Invalid CRM Sync payload");

                    // Fetch team settings to get API Key
                    // Simplified: Fetch User settings from payload.userId
                    const userId = (job.payload as any).userId;
                    if (!userId) {
                        console.log("Skipping CRM Sync: No userId in payload");
                        result = { skipped: true, reason: "No userId" };
                        break;
                    }

                    const settings = await prisma.settings.findUnique({ where: { userId } });

                    if (!settings || !(settings as any).hubspotApiKey) {
                        console.log("Skipping CRM Sync: No HubSpot API Key configured.");
                        result = { skipped: true, reason: "No API Key" };
                        break;
                    }

                    const hubspot = new HubSpotService((settings as any).hubspotApiKey);

                    // Fetch Lead Data
                    const leadId = (job.payload as any).leadId;
                    const lead = await prisma.lead.findUnique({ where: { id: leadId } });

                    if (!lead) throw new Error("Lead not found");

                    const syncResult = await hubspot.syncContact(lead);
                    result = { status: "success", backendId: syncResult.id, action: syncResult.action };
                    break;

                // ... existing code ...
                case "agent_run":
                    console.log(`🤖 Starting Agent ${(job.payload as any).agentId}...`);
                    result = { status: "started" };
                    break;

                case "agent_stop":
                    console.log(`🛑 Stopping Agent ${(job.payload as any).agentId}...`);
                    result = { status: "stopped" };
                    break;

                case "workflow_step":
                    if (!job.payload || typeof job.payload !== 'object') throw new Error("Invalid workflow_step payload");
                    const { runId, nodeId } = job.payload as { runId: string, nodeId: string };
                    const { WorkflowService } = require("@/lib/workflowService");
                    result = await WorkflowService.processNode(runId, nodeId);
                    break;

                case "email_sending":
                    if (!job.payload || typeof job.payload !== 'object') throw new Error("Invalid email_sending payload");
                    const emailPayload = job.payload as any;
                    const { EmailService } = require("@/lib/emailService");
                    // Fetch lead email if only leadId provided
                    let targetEmail = emailPayload.email;
                    if (!targetEmail && emailPayload.leadId) {
                        const targetLead = await prisma.lead.findUnique({ where: { id: emailPayload.leadId } });
                        targetEmail = targetLead?.email;
                    }
                    if (targetEmail) {
                        result = await EmailService.sendEmail(targetEmail, emailPayload.subject || "Follow up", emailPayload.body || "Hi there!", emailPayload.teamId);
                    }
                    break;

                case "WEBHOOK_DISPATCH":
                    if (!job.payload || typeof job.payload !== 'object') throw new Error("Invalid webhook_dispatch payload");
                    const { webhookId: whId, event: whEvent, payload: whPayload } = job.payload as any;
                    const { webhookService: whService } = require("@/modules/webhooks/service/webhookService");
                    result = await whService.processDelivery(whId, whEvent, whPayload);
                    break;

                default:
                    console.warn(`Unknown job type: ${job.type}`);
                    result = { skipped: true };
            }

            await JobQueue.complete(job.id, result);
            logger.info(`✅ Job ${job.id} completed`, { jobId: job.id, result });

            // Notifications logic...
            if (job.payload && typeof job.payload === 'object' && 'userId' in job.payload && job.payload.userId) {
                const userId = job.payload.userId as string;
                let message = `Job ${job.type} completed successfully.`;
                if (job.type === "data_export") message = `Your data export is ready.`;

                await prisma.notification.create({
                    data: {
                        userId,
                        type: "success",
                        message,
                        meta: { jobId: job.id, result }
                    }
                });
            }

            setImmediate(processNextJob);

        } catch (error) {
            logger.error(`❌ Job ${job.id} failed:`, { jobId: job.id, error });
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            await JobQueue.fail(job.id, errorMessage);

            // Notifications logic...
            if (job.payload && typeof job.payload === 'object' && 'userId' in job.payload && job.payload.userId) {
                const userId = job.payload.userId as string;
                await prisma.notification.create({
                    data: {
                        userId,
                        type: "alert",
                        message: `Job ${job.type} failed: ${errorMessage}`,
                        meta: { jobId: job.id }
                    }
                });
            }

            setImmediate(processNextJob);
        }
    } catch (err) {
        console.error("Critical worker error:", err);
        setTimeout(processNextJob, POLLING_INTERVAL);
    }
}

// Start processing
processNextJob();

// Handle graceful shutdown
process.on("SIGTERM", async () => {
    console.log("SIGTERM received. Shutting down worker...");
    await prisma.$disconnect();
    process.exit(0);
});

process.on("SIGINT", async () => {
    console.log("SIGINT received. Shutting down worker...");
    await prisma.$disconnect();
    process.exit(0);
});
