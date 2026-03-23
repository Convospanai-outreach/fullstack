import { prisma } from "@/lib/db";
import { CapabilityLayer } from "@prisma/client";

export class ContractResolver {

    /**
     * Resolves the active contract for a team and verifies access to a capability.
     * Throws strictly if access is denied.
     */
    static async resolveOrThrow(teamId: string, requiredCapability: CapabilityLayer | string, channel?: string) {
        const profile = await prisma.contractProfile.findUnique({
            where: { teamId }
        });

        if (!profile) {
            // Default fallback: Block if no profile exists in Phase 9 (Hard Enforcement)
            console.warn(`[ContractResolver] No profile found for team ${teamId}. Blocking execution.`);
            throw new Error("CONTRACT_MISSING_PROFILE");
        }

        // 0. Emergency Status Check
        if (profile.contractStatus === "TERMINATED" || profile.contractStatus === "SUSPENDED") {
            await this.logDenial(teamId, "STATUS_CHECK", `Contract status is ${profile.contractStatus}`);
            throw new Error(`CONTRACT_STATUS_${profile.contractStatus}`);
        }

        // 1. Check Capability Layer
        const layer = String(requiredCapability);
        if (!profile.allowedCapabilityLayers.includes(layer) && !profile.allowedCapabilityLayers.includes("ALL_FEATURES")) {
            await this.logDenial(teamId, "CAPABILITY_CHECK", `Missing layer: ${layer}`);
            throw new Error(`CONTRACT_CAPABILITY_DENIED: ${layer}`);
        }

        // 2. Check Channel (if applicable)
        if (channel) {
            if (!profile.allowedChannels.includes(channel)) {
                await this.logDenial(teamId, "CHANNEL_CHECK", `Channel denied: ${channel}`);
                throw new Error(`CONTRACT_CHANNEL_DENIED: ${channel}`);
            }
        }

        return profile;
    }

    private static async logDenial(teamId: string, checkType: string, reason: string) {
        const { EventStore, SystemEventType } = await import("@/modules/learning/EventStore");
        await EventStore.record({
            type: SystemEventType.SYSTEM,
            name: "CONTRACT_DENIAL",
            teamId,
            payload: {
                checkType,
                reason,
                timestamp: new Date()
            }
        });
    }

    static async getLimits(teamId: string) {
        const profile = await prisma.contractProfile.findUnique({
            where: { teamId }
        });
        return {
            aiLimit: profile?.aiUsageLimit || 0,
            threadLimit: profile?.conversationThreadLimit || 0,
            handoffLimit: profile?.humanHandoffLimit || 0
        };
    }
}
