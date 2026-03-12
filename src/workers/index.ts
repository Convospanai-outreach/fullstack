
import { JobQueue, JobPayload } from "@/lib/queue";
import { prisma } from "@/lib/db";
import { executeCampaign } from "./handlers/campaign-worker";
import { deductCredits } from "../lib/credits";
import { handleLinkedInAction } from "./handlers/linkedin";
import { HubSpotService } from "@/lib/crm";
import { agentExecutor, AgentState } from "@/modules/agent/core/AgentExecutor";
import { handleSequenceAction } from "./handlers/sequenceHandlers";

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

        const payload = job.payload as unknown as JobPayload;
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
                    if (!payload || typeof payload !== 'object' || !payload['campaignId']) {
                        throw new Error("Invalid payload for campaign_execution");
                    }
                    const campaignId = payload['campaignId'];
                    result = await executeCampaign(campaignId);
                    break;

                case "linkedin_action": // Maps to LINKEDIN_ACTION job type
                case "LINKEDIN_ACTION":
                    // Credit Check: -2 credits
                    if (job.teamId) {
                        const hasCredits = await deductCredits(job.teamId, 2, "LinkedIn Action", { jobId: job.id });
                        if (!hasCredits) throw new Error("Insufficient credits");
                    }
                    result = await handleLinkedInAction(payload as any);
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
                    result = { filename, url: `${process.env.NEXT_PUBLIC_API_URL}/exports/${filename}` };
                    break;



                // ... inside switch ...
                case "crm_sync":
                case "CRM_SYNC":
                    if (!payload || !job.teamId) throw new Error("Invalid CRM Sync payload");

                    // Fetch team settings to get API Key
                    // Simplified: Fetch User settings from payload.userId
                    const userId = payload['userId'];
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
                    const leadId = payload['leadId'];
                    if (!leadId) throw new Error("Lead ID missing for CRM Sync");
                    const lead = await prisma.lead.findUnique({ where: { id: leadId } });

                    if (!lead) throw new Error("Lead not found");

                    const syncResult = await hubspot.syncContact(lead);
                    result = { status: "success", backendId: syncResult.id, action: syncResult.action };
                    break;

                // ... existing code ...
                case "agent_run": {
                    const agentId = payload['agentId'];
                    const goal = payload['goal'] || "Perform autonomous generation";
                    const teamId = job.teamId;
                    
                    if (!teamId) throw new Error("Team ID required for agent_run");

                    logger.info(`🤖 Starting Agent Task for agent ${agentId}...`, { agentId, goal });

                    // 1. Create a task via Executor
                    const taskId = await agentExecutor.startTask(teamId, goal as string, payload['context'] as any || {});
                    
                    // 2. Run the loop (blocks until completed, failed, or awaiting human approval)
                    const status = await agentExecutor.runToCompletion(taskId);
                    
                    result = { status, taskId };
                    
                    if (status === AgentState.FAILED) {
                        throw new Error(`Agent Task Failed (Status: ${status})`);
                    }
                    break;
                }

                case "agent_stop": {
                    const taskId = payload['taskId'];
                    if (!taskId) throw new Error("Missing taskId for agent_stop");
                    
                    logger.info(`🛑 Stopping Agent Task ${taskId}...`, { taskId });
                    
                    await prisma.agentTask.update({
                        where: { id: taskId as string },
                        data: { status: AgentState.FAILED }
                    });
                    
                    result = { status: "stopped", taskId };
                    break;
                }

                case "SEQUENCE_ACTION": {
                    result = await handleSequenceAction(payload as any);
                    break;
                }

                // ... (kept cases consistent)

                default:
                    logger.warn(`Unknown job type: ${job.type}`, { jobId: job.id });
                    result = { skipped: true };
            }

            await JobQueue.complete(job.id, result);
            logger.info(`✅ Job ${job.id} completed`, { jobId: job.id, result });

            // Notifications logic...
            if (payload && typeof payload === 'object' && payload['userId']) {
                const userId = payload['userId'];
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
            if (payload && typeof payload === 'object' && payload['userId']) {
                const userId = payload['userId'];
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
        logger.error("Critical worker error:", { error: err });
        setTimeout(processNextJob, POLLING_INTERVAL);
    }
}

// 2. Start Watchdog (Every 5 minutes)
setInterval(async () => {
    try {
        await JobQueue.resetStaleJobs();
    } catch (err) {
        logger.error("Watchdog failed:", err);
    }
}, 1000 * 60 * 5);

// Start processing
processNextJob();

// Handle graceful shutdown
process.on("SIGTERM", async () => {
    logger.info("SIGTERM received. Shutting down worker...");
    await prisma.$disconnect();
    process.exit(0);
});

process.on("SIGINT", async () => {
    logger.info("SIGINT received. Shutting down worker...");
    await prisma.$disconnect();
    process.exit(0);
});
