import { prisma } from "@/lib/db";
import { linkedinRunnerService } from "@/modules/linkedin-runner/service/linkedinRunnerService";

/**
 * LinkedIn Automation Worker
 * Handles background processing of LinkedIn actions
 */
export async function handleLinkedInScrape(payload: {
    profileUrl: string;
    action?: string;
    leadId?: string;
}) {
    const { profileUrl, action = "scrape", leadId } = payload;

    console.log(`🤖 Processing LinkedIn action: ${action} for ${profileUrl}`);

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

        return result;
    } catch (error) {
        console.error("LinkedIn automation failed:", error);
        throw error;
    }
}
