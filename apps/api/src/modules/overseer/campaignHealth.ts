import { prisma } from "@/lib/db";
import { strategyIdsFromConfig } from "./strategyStall";

// Once a day, checks every live campaign sequence for the two things the campaign builder warns about
// while a drip is being made, because a campaign can drift after it is saved: its pace (how far apart
// and how many emails go out) and whether its ICP still suits its strategy. Findings become advisory
// OverseerNudges; nothing is paused or changed.
//
// The pace limits and the ICP size limits repeat the web app's (apps/web/src/lib/campaigns/paceRules.ts
// and icpFit.ts) because the two apps share no package; campaignHealth.drift.test.ts fails if they
// diverge. The web rules also carry info-level notes that are not raised here.

export const CAMPAIGN_NUDGE_TYPE = "CAMPAIGN_HEALTH";
// A finding that was raised, or dismissed, in this window is not raised again.
const RESURFACE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;
const BATCH_SIZE = 500;

export const PACE_LIMITS = { minGapHours: 48, maxFirstWeekEmails: 3, firstWeekDays: 7, maxEmails: 6, maxSpanDays: 90 };
export const ICP_LIMITS = { maxRoles: 5, maxIndustries: 3 };

// Strategies that change the pace limits (web: STRATEGIES[].pace).
const STRATEGY_PACE: Record<string, Partial<typeof PACE_LIMITS>> = {
    S3: { minGapHours: 24, maxFirstWeekEmails: 7, maxEmails: 14 },
    S11: { maxEmails: 10 },
};

const HOURS_PER_DAY = 24;

export interface PaceStep {
    stepType: string;
    delayDays: number;
    delayHours: number;
}

export interface HealthFinding {
    ruleId: string;
    message: string;
}

export function paceLimitsFor(strategyIds: readonly string[]): typeof PACE_LIMITS {
    // Same as the web app: strategies in the order chosen, a later one winning on a limit both set.
    let limits = { ...PACE_LIMITS };
    for (const id of strategyIds) {
        const pace = STRATEGY_PACE[id];
        if (pace) limits = { ...limits, ...pace };
    }
    return limits;
}

const days = (hours: number) => (hours / HOURS_PER_DAY).toFixed(hours % HOURS_PER_DAY === 0 ? 0 : 1);

export function paceFindings(steps: readonly PaceStep[], limits = PACE_LIMITS): HealthFinding[] {
    const touches: Array<{ atHours: number; gapHours: number | null }> = [];
    let clock = 0;
    let lastEmailAt: number | null = null;
    for (const step of steps) {
        clock += Math.max(0, step.delayDays || 0) * HOURS_PER_DAY + Math.max(0, step.delayHours || 0);
        if (step.stepType !== "EMAIL") continue;
        touches.push({ atHours: clock, gapHours: lastEmailAt === null ? null : clock - lastEmailAt });
        lastEmailAt = clock;
    }

    const findings: HealthFinding[] = [];
    const tooClose = touches.filter((t) => t.gapHours !== null && t.gapHours < limits.minGapHours);
    if (tooClose.length > 0) {
        const shortest = Math.min(...tooClose.map((t) => t.gapHours as number));
        findings.push({
            ruleId: "email-gap",
            message: `${tooClose.length} email${tooClose.length === 1 ? " follows" : "s follow"} the last one after less than ${days(limits.minGapHours)} days (shortest ${days(shortest)}). Emails this close read as pressure and raise unsubscribes and spam complaints.`,
        });
    }
    const firstWeek = touches.filter((t) => t.atHours < limits.firstWeekDays * HOURS_PER_DAY);
    if (firstWeek.length > limits.maxFirstWeekEmails) {
        findings.push({
            ruleId: "first-week-load",
            message: `${firstWeek.length} emails go out in the first week. More than ${limits.maxFirstWeekEmails} is a heavy opening for a contact who has not replied.`,
        });
    }
    if (touches.length > limits.maxEmails) {
        findings.push({
            ruleId: "email-count",
            message: `The drip has ${touches.length} emails. More than ${limits.maxEmails} to a silent contact rarely pays and keeps raising complaints.`,
        });
    }
    const last = touches[touches.length - 1];
    if (last && last.atHours > limits.maxSpanDays * HOURS_PER_DAY) {
        findings.push({
            ruleId: "sequence-length",
            message: `The last email goes out ${days(last.atHours)} days after the start. A contact silent for ${limits.maxSpanDays} days should be sunset to protect your sender reputation.`,
        });
    }
    return findings;
}

function count(value: unknown): number {
    if (Array.isArray(value)) return value.filter((v) => typeof v === "string" && v.trim()).length;
    return typeof value === "string" && value.trim() ? 1 : 0;
}

// Only the warnings: the broad-to-niche funnel (S10) and 4-3-2-1 distribution (S11) against an ICP that is too wide.
export function icpFindings(criteria: unknown, strategyIds: readonly string[]): HealthFinding[] {
    const c = typeof criteria === "object" && criteria !== null ? (criteria as Record<string, unknown>) : {};
    const size = c["companySize"] ?? c["size"];
    const roles = count(c["jobTitles"]) || count(c["role"]);
    const industries = count(c["industries"]) || count(c["industry"]);
    const hasSize = typeof size === "object" ? size !== null : count(size) > 0;
    const hasPain = count(c["painPoints"]) > 0;
    const defined = [roles > 0, industries > 0, hasSize, hasPain].filter(Boolean).length;
    const tooWide = roles > ICP_LIMITS.maxRoles || industries > ICP_LIMITS.maxIndustries;

    const findings: HealthFinding[] = [];
    if (strategyIds.includes("S10") && (defined <= 1 || tooWide)) {
        findings.push({
            ruleId: "icp-S10",
            message: "The campaign uses the broad-to-niche funnel but its ICP is too wide to narrow. Add a role, an industry and a company size or pain point.",
        });
    }
    if (strategyIds.includes("S11") && tooWide) {
        findings.push({
            ruleId: "icp-S11",
            message: `The campaign uses 4-3-2-1 distribution, which expects one audience, but its ICP spans ${roles} roles and ${industries} industries. Split it into separate ICPs.`,
        });
    }
    return findings;
}

export async function runCampaignHealth(now = new Date()): Promise<{ sequencesChecked: number; nudgesCreated: number }> {
    const sequences = await prisma.campaignSequence.findMany({
        where: { status: "ACTIVE", campaignId: { not: null } },
        take: BATCH_SIZE,
        select: {
            id: true,
            teamId: true,
            name: true,
            campaign: { select: { aiConfig: true, icp: { select: { criteria: true } } } },
            steps: {
                where: { status: "ACTIVE" },
                orderBy: { stepOrder: "asc" },
                select: { stepType: true, delayDays: true, delayHours: true },
            },
        },
    });

    let nudgesCreated = 0;
    const since = new Date(now.getTime() - RESURFACE_AFTER_MS);

    for (const sequence of sequences) {
        const strategyIds = strategyIdsFromConfig(sequence.campaign?.aiConfig);
        const findings = [
            ...paceFindings(sequence.steps, paceLimitsFor(strategyIds)),
            ...icpFindings(sequence.campaign?.icp?.criteria, strategyIds),
        ];
        const current = new Set(findings.map((f) => f.ruleId));

        const earlier = await prisma.overseerNudge.findMany({
            where: { teamId: sequence.teamId, sequenceId: sequence.id, nudgeType: CAMPAIGN_NUDGE_TYPE },
            select: { id: true, stage: true, status: true, createdAt: true },
        });

        // Close nudges for findings that are fixed.
        const fixed = earlier.filter((n) => n.status === "OPEN" && !current.has(n.stage)).map((n) => n.id);
        if (fixed.length > 0) {
            await prisma.overseerNudge.updateMany({ where: { id: { in: fixed } }, data: { status: "DISMISSED" } });
        }

        for (const finding of findings) {
            const recent = earlier.some((n) => n.stage === finding.ruleId && (n.status === "OPEN" || n.createdAt >= since));
            if (recent) continue;
            await prisma.overseerNudge.create({
                data: {
                    teamId: sequence.teamId,
                    sequenceId: sequence.id,
                    stage: finding.ruleId,
                    stallDays: 0,
                    nudgeType: CAMPAIGN_NUDGE_TYPE,
                    suggestion: `${sequence.name}: ${finding.message}`,
                },
            });
            nudgesCreated += 1;
        }
    }

    return { sequencesChecked: sequences.length, nudgesCreated };
}
