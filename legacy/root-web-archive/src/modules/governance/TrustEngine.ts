
import { prisma } from "@/lib/db";

export interface TrustMetrics {
    score: number;
    level: "HIGH" | "MEDIUM" | "LOW" | "PROBATION";
    canAutoSend: boolean;
    requiresApproval: boolean;
    coolingDown: boolean;
}

export class TrustEngine {
    /**
     * Task 3: Compute trust scores (Non-Overrideable)
     * Derived from raw events to prevent tampering.
     */
    static async getTrustMetrics(teamId: string): Promise<TrustMetrics> {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Fetch aggregate signals
        const events = await prisma.systemEvent.findMany({
            where: {
                teamId,
                timestamp: { gte: thirtyDaysAgo }
            },
            select: { name: true }
        });

        const stats = {
            approvals: events.filter(e => e.name === "ACTION_APPROVED").length,
            rejections: events.filter(e => e.name === "ACTION_REJECTED").length,
            bounces: events.filter(e => e.name === "BOUNCE").length,
            spamComplaints: events.filter(e => e.name === "SPAM_COMPLAINT").length,
            violations: events.filter(e => e.name === "RATE_LIMIT_VIOLATION").length,
            totalActions: events.length
        };

        // Non-Overrideable Formula (Task 3)
        // Base score 100
        let score = 100;

        // Negative weightings
        score -= (stats.rejections * 5);        // Rejections indicate poor alignment
        score -= (stats.bounces * 10);         // High bounce = poor list hygiene
        score -= (stats.spamComplaints * 50); // Spam is critical
        score -= (stats.violations * 20);      // Breaking engine rules

        // Positive weighting
        if (stats.approvals > 50) score += 10;

        score = Math.max(0, Math.min(100, score));

        // Derived Level
        let level: TrustMetrics["level"] = "HIGH";
        if (score < 80) level = "MEDIUM";
        if (score < 60) level = "LOW";
        if (score < 40) level = "PROBATION";

        return {
            score,
            level,
            canAutoSend: score > 90,
            requiresApproval: score <= 90,
            coolingDown: level === "PROBATION"
        };
    }

    /**
     * Task 5: Hard Policy Enforcement
     */
    static async enforcePolicy(teamId: string, actionType: string) {
        const metrics = await this.getTrustMetrics(teamId);

        // Global Kill Switch logic (Task 5)
        if (metrics.coolingDown) {
            throw new Error(`Hard Block: Workspace is in probation (Trust Score: ${metrics.score}). Automation suspended.`);
        }

        // Action-specific limits
        if (actionType === "BULK_OUTREACH" && !metrics.canAutoSend) {
            throw new Error("Hard Block: Automatic bulk outreach requires Trust Score > 90. Human review mode enforced.");
        }

        return metrics;
    }
}
