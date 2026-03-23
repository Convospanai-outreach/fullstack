import { prisma } from "@/lib/db";
import { EventStore, SystemEventType } from "@/modules/learning/EventStore";

type KillSwitchType = "OUTBOUND" | "AI" | "CALLER" | "ALL";

export class KillSwitch {

    /**
     * Checks if a specific capability is killed at the Org level.
     * Logs every check failure to audit trail.
     */
    static async verifyOrDie(teamId: string, type: KillSwitchType = "ALL") {
        const profile = await prisma.contractProfile.findUnique({
            where: { teamId }
        });

        if (!profile) {
            await this.logKill(teamId, type, "MISSING_PROFILE");
            throw new Error("KILL_SWITCH_ENGAGED: PROFILE_MISSING");
        }

        // 1. Global System Halt
        if (profile.contractStatus === "TERMINATED") {
            await this.logKill(teamId, type, "CONTRACT_TERMINATED");
            throw new Error("KILL_SWITCH_ENGAGED: CONTRACT_TERMINATED");
        }

        if (profile.contractStatus === "SUSPENDED") {
            await this.logKill(teamId, type, "CONTRACT_SUSPENDED");
            throw new Error("KILL_SWITCH_ENGAGED: CONTRACT_SUSPENDED");
        }

        // 2. Granular Capability Freezes (Future expansion: add specific flags to ContractProfile if needed)
        // For Phase 9, status SUSPENDED implies ALL.
        // If we want partial freezes (e.g. only AI), we would check `allowedCapabilityLayers`.

        if (type === "AI") {
            if (!profile.allowedCapabilityLayers.includes("GOVERNED_AI") &&
                !profile.allowedCapabilityLayers.includes("ALL_FEATURES")) {
                await this.logKill(teamId, type, "AI_DISABLED_IN_CONTRACT");
                throw new Error("KILL_SWITCH_ENGAGED: AI_DISABLED");
            }
        }
    }

    private static async logKill(teamId: string, type: string, reason: string) {
        await EventStore.record({
            type: SystemEventType.SYSTEM,
            name: "KILL_SWITCH_TRIGGERED",
            teamId,
            payload: {
                targetType: type,
                reason,
                timestamp: new Date()
            }
        });
    }
}
