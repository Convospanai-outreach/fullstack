
/**
 * Unified UI Controller (Tasks 4, 7, 8)
 */

export type UserMode = "BEGINNER" | "POWER_USER";

export interface FeatureGate {
    key: string;
    minTrustScore: number;
    userMode: UserMode[];
}

export const APP_FEATURE_GATES: FeatureGate[] = [
    { key: "auto_outreach", minTrustScore: 90, userMode: ["POWER_USER"] },
    { key: "bulk_tasks", minTrustScore: 70, userMode: ["POWER_USER"] },
    { key: "causal_insights", minTrustScore: 80, userMode: ["POWER_USER"] },
    { key: "draft_review", minTrustScore: 0, userMode: ["BEGINNER", "POWER_USER"] }
];

export class UIArchitect {
    /**
     * Task 8: Progressive Disclosure - Get visible features
     */
    static getVisibleFeatures(trustScore: number, mode: UserMode): string[] {
        return APP_FEATURE_GATES
            .filter(gate => trustScore >= gate.minTrustScore && gate.userMode.includes(mode))
            .map(gate => gate.key);
    }

    /**
     * Task 4: XAI-Lite - Human-readable explanation (No model internals)
     */
    static getExplanationNarrative(outcomeWeights: any, context: string): string {
        if (outcomeWeights.highSuccess) {
            return `This draft uses patterns that led to a 12% higher reply rate for ${context} last week.`;
        }
        if (outcomeWeights.newPattern) {
            return `Exploring a new approach based on similar successful outreach in your sector.`;
        }
        return `Standard verified outreach template optimized for clarity.`;
    }

    /**
     * Task 7: Audit Trail Access Rules
     */
    static canViewSensitiveAudit(trustScore: number): boolean {
        // High trust required to see deep system logs
        return trustScore > 85;
    }
}
