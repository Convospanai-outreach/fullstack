import { prisma } from "@/lib/db";
import { linkedinRunnerService } from "@/modules/linkedin-runner/service/linkedinRunnerService";
import { logger, logWorker } from "@/lib/logger";

/**
 * LinkedIn Automation Worker
 * Handles background processing of LinkedIn actions
 */
export async function handleLinkedInScrape(payload: {
    profileUrl: string;
    action?: string;
    leadId?: string;
    teamId?: string;
}) {
    const { profileUrl, action = "scrape", leadId, teamId } = payload;

    logWorker(leadId || profileUrl, `LINKEDIN_${action.toUpperCase()}`, { profileUrl, teamId });

    try {
        const result = await linkedinRunnerService.runAutomation({
            profileUrl,
            action,
        });

        // Log activity
        await prisma.activity.create({
            data: {
                type: `linkedin_${action}`,
                meta: {
                    profileUrl,
                    leadId,
                    result: result.result,
                },
            },
        });

        // Update lead if applicable
        if (leadId && action === "connect") {
            await prisma.lead.update({
                where: { id: leadId },
                data: { status: "connection_sent" },
            });
        }

        logger.info(`[Worker] LinkedIn ${action} successful for ${profileUrl}`, { leadId, teamId });

        return result;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        logger.error(`[Worker] LinkedIn automation failed for ${profileUrl}`, { action, error: errorMessage });
        throw error;
    }
}
