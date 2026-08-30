import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { judgeStalledEnrollments, StallCandidate } from "./deepseekClient";

const STALL_THRESHOLD_DAYS = parseInt(process.env["OVERSEER_STALL_THRESHOLD_DAYS"] || "5");
const BATCH_SIZE = parseInt(process.env["OVERSEER_BATCH_SIZE"] || "20");
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Overseer v0, primary job (see OVERSEER_ARCHITECTURE_PLAN.md §02): finds ACTIVE
 * sequence enrollments with nothing scheduled next that have gone quiet past a
 * threshold, and writes an advisory OverseerNudge for each - never mutates the
 * enrollment, never sends anything.
 *
 * The threshold is a flat number of days, not the plan's per-stage p90 baseline -
 * that baseline needs historical SequenceStepRun data this system doesn't have
 * enough of yet (see plan §09 open questions). Revisit once it does.
 */
export async function runOverseerTick(): Promise<{ candidates: number; nudgesCreated: number }> {
    const cutoff = new Date(Date.now() - STALL_THRESHOLD_DAYS * MS_PER_DAY);

    const alreadyNudged = await prisma.overseerNudge.findMany({
        where: { status: "OPEN", enrollmentId: { not: null } },
        select: { enrollmentId: true }
    });
    const alreadyNudgedIds = alreadyNudged.map((n) => n.enrollmentId as string);

    const stalled = await prisma.sequenceEnrollment.findMany({
        where: {
            status: "ACTIVE",
            nextRunAt: null,
            id: { notIn: alreadyNudgedIds },
            OR: [
                { lastRunAt: { lt: cutoff } },
                { lastRunAt: null, startedAt: { lt: cutoff } }
            ]
        },
        take: BATCH_SIZE,
        select: {
            id: true,
            teamId: true,
            leadId: true,
            sequenceId: true,
            currentStepOrder: true,
            lastRunAt: true,
            startedAt: true,
            sequence: { select: { name: true, _count: { select: { steps: true } } } }
        }
    });

    if (stalled.length === 0) {
        return { candidates: 0, nudgesCreated: 0 };
    }

    const now = Date.now();
    const candidates: StallCandidate[] = stalled.map((enrollment) => {
        const anchor = enrollment.lastRunAt || enrollment.startedAt;
        const stallDays = (now - anchor.getTime()) / MS_PER_DAY;
        const totalSteps = enrollment.sequence._count.steps;
        return {
            enrollmentId: enrollment.id,
            sequenceName: enrollment.sequence.name,
            stage: totalSteps > 0 ? `step ${enrollment.currentStepOrder + 1} of ${totalSteps}` : `step ${enrollment.currentStepOrder + 1}`,
            stallDays
        };
    });

    const judgments = await judgeStalledEnrollments(candidates);
    const byEnrollmentId = new Map(stalled.map((e) => [e.id, e]));

    let created = 0;
    for (const judgment of judgments) {
        const enrollment = byEnrollmentId.get(judgment.enrollmentId);
        const candidate = candidates.find((c) => c.enrollmentId === judgment.enrollmentId);
        if (!enrollment || !candidate) continue;

        await prisma.overseerNudge.create({
            data: {
                teamId: enrollment.teamId,
                leadId: enrollment.leadId,
                sequenceId: enrollment.sequenceId,
                enrollmentId: enrollment.id,
                stage: candidate.stage,
                stallDays: candidate.stallDays,
                nudgeType: judgment.nudgeType,
                suggestion: judgment.suggestion
            }
        });
        created += 1;
    }

    logger.info("[Overseer] Tick complete", { candidates: stalled.length, nudgesCreated: created });
    return { candidates: stalled.length, nudgesCreated: created };
}
