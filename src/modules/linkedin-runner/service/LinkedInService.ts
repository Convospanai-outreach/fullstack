import { HardwareService } from "@/services/HardwareService";
import { prisma } from "@/lib/db";
import { LinkedInConstants } from "./LinkedInConstants";

export class LinkedInService {
    /**
     * Sends a connection request to a lead via the Physical Edge Node.
     * Uses the HardwareService to actuate the browser.
     */
    static async sendConnectionRequest(leadId: string, _teamId: string, _userId: string, message?: string) {
        // 1. Fetch Lead Data
        const lead = await prisma.lead.findUnique({
            where: { id: leadId }
        });

        // 1b. Enterprise Contract Enforcement (Phase 9)
        if (_teamId) {
            const { KillSwitch } = await import("@/modules/contract/killSwitch");
            const { ContractResolver } = await import("@/modules/contract/contractResolver");

            // a. Emergency Stop (Outbound)
            await KillSwitch.verifyOrDie(_teamId, "OUTBOUND");

            // b. Contract Capability Check (Channel: LINKEDIN)
            // LinkedIn is usually ADVANCED_OPS or just channel restricted
            await ContractResolver.resolveOrThrow(_teamId, "ADVANCED_OPS", "LINKEDIN");
        }

        if (!lead || !lead.linkedIn) {
            throw new Error("Lead not found or missing LinkedIn URL");
        }

        // 2. Hardware Execution
        try {
            console.log(`[LinkedInService] Initiating Connection Request for ${lead.fullName}...`);

            // Execute the hardware action
            await HardwareService.execute('send_connection', {
                url: lead.linkedIn,
                message: message, // Optional note
                selectors: LinkedInConstants.SELECTORS
            });

            // 3. Update Lead Status
            await prisma.lead.update({
                where: { id: leadId },
                data: {
                    status: "CONTACTED",
                    pipelineState: "WARM",
                    // Also log the activity
                }
            });

            // 4. Create Activity Log
            await prisma.activity.create({
                data: {
                    type: "LINKEDIN_CONNECT",
                    message: `Connection request sent to ${lead.fullName}`,
                    campaignId: lead.campaignId,
                    meta: {
                        leadId,
                        linkedinUrl: lead.linkedIn,
                        withNote: !!message
                    }
                }
            });

            return { success: true };

        } catch (error: any) {
            console.error("[LinkedInService] Connection Failed", error);

            // Log failure but don't crash core flow if possible, or rethrow
            await prisma.activity.create({
                data: {
                    type: "LINKEDIN_CONNECT_FAIL",
                    message: `Failed to connect with ${lead.fullName}: ${error.message}`,
                    campaignId: lead.campaignId
                }
            });

            throw error;
        }
    }

    /**
     * Checks if a user is connected
     */
    static async checkConnectionStatus(_leadId: string): Promise<boolean> {
        // Implementation for checking status via scraping or specialized edge endpoint
        // Placeholder
        return false;
    }
}
