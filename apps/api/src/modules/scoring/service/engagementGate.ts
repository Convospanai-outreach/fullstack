import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { NOUL_YES, judgeEngagement, type EngagementFacts } from "@/lib/ai/jev";

// Scoring decides a lead *looks* WARM or HOT from counts (clicks, dwell time). A count is not interest: mail
// scanners click links. So a score may only move the stage after Jev judges the behaviour to be real interest,
// and then by one stage at a time (COLD -> WARM -> HOT). If Jev cannot answer, the lead does not move.

const NEXT_STAGE: Record<string, string> = { COLD: "WARM", WARM: "HOT" };
const JUDGED_ACTION = "ENGAGEMENT_JUDGED";

type Emails = Array<{ createdAt: Date; clickedAt: Date | null }>;

export function buildEngagementFacts(
    lead: { dwellTimeMinutes?: number | null; socialMentions?: number | null; pipelineState?: string | null },
    emails: Emails,
    emailClicks: number,
    now = new Date()
): EngagementFacts {
    const clickGaps = emails.filter((e) => e.clickedAt).map((e) => Math.max(0, Math.round((e.clickedAt!.getTime() - e.createdAt.getTime()) / 1000)));
    const first = emails.length ? Math.min(...emails.map((e) => e.createdAt.getTime())) : null;
    return {
        emailsSent: emails.length,
        emailClicks,
        fastestClickSeconds: clickGaps.length ? Math.min(...clickGaps) : null,
        dwellTimeMinutes: lead.dwellTimeMinutes ?? 0,
        socialMentions: lead.socialMentions ?? 0,
        daysSinceFirstEmail: first === null ? null : Math.floor((now.getTime() - first) / 86_400_000),
        stage: lead.pipelineState ?? "COLD",
    };
}

// Same facts, same stage => same answer, so a re-score does not pay for a second judgment.
function hashFacts(facts: EngagementFacts) {
    return createHash("sha256").update(JSON.stringify({ ...facts, daysSinceFirstEmail: undefined })).digest("hex").slice(0, 32);
}

/**
 * `candidate` is the stage the score alone would move the lead to (or null). Returns the stage the lead may
 * actually move to: the next one up when Jev judges real interest, otherwise null. Never throws.
 */
export async function gateStagePromotion(params: { leadId: string; teamId: string; currentState: string; candidate: string | null; facts: EngagementFacts }): Promise<string | null> {
    const next = NEXT_STAGE[params.currentState];
    if (!params.candidate || !next) return null;

    try {
        const hash = hashFacts(params.facts);
        const prior = await prisma.auditLog.findFirst({
            where: { orgId: params.teamId, action: JUDGED_ACTION, entity: "lead", entityId: params.leadId },
            orderBy: { createdAt: "desc" },
            select: { metadata: true },
        });
        const priorMeta = prior?.metadata as { hash?: string; interested?: boolean } | null;
        if (priorMeta?.hash === hash && typeof priorMeta.interested === "boolean") {
            return priorMeta.interested ? next : null;
        }

        const judgment = await judgeEngagement(params.facts, params.teamId);
        const interested = judgment.genuineInterest >= NOUL_YES && judgment.likelyAutomated < NOUL_YES;
        await prisma.auditLog.create({
            data: {
                orgId: params.teamId,
                action: JUDGED_ACTION,
                entity: "lead",
                entityId: params.leadId,
                metadata: { hash, interested, genuineInterest: judgment.genuineInterest, likelyAutomated: judgment.likelyAutomated },
            },
        });
        return interested ? next : null;
    } catch (error) {
        // Jev unavailable (or the log write failed): no answer is not a yes, so the lead stays where it is.
        logger.warn("[EngagementGate] No judgment, lead not promoted", { leadId: params.leadId, error: error instanceof Error ? error.message : String(error) });
        return null;
    }
}
