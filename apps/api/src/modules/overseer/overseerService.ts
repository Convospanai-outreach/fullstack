import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { SovereignFirewall } from "@/lib/ai/SovereignFirewall";
import { toPlainText } from "@/modules/inbox/actionInboxService";
import { judgeStalledEnrollments, judgeStalledEnrollmentsWithJev, stallJevFlagKeys, stallJevMode, StallCandidate, StallJevInput, StallJevMode } from "./stallJudgment";
import type { StallThreadMessage } from "@/lib/ai/jev";

const STALL_THRESHOLD_DAYS = parseInt(process.env["OVERSEER_STALL_THRESHOLD_DAYS"] || "5");
const BATCH_SIZE = parseInt(process.env["OVERSEER_BATCH_SIZE"] || "20");
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const STALL_THREAD_MESSAGES = 5;

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

    // Circuit breaker throttle (plan §04): a team whose approval queue is backed up
    // (breaker OPEN/HALF_OPEN) gets zero new nudges this tick, so the Overseer stops
    // adding to a queue that's already failing to keep up.
    const throttledTeams = await prisma.breakerState.findMany({
        where: { state: { in: ["OPEN", "HALF_OPEN"] } },
        select: { teamId: true }
    });
    const throttledTeamIds = throttledTeams.map((t) => t.teamId);

    const stalled = await prisma.sequenceEnrollment.findMany({
        where: {
            status: "ACTIVE",
            nextRunAt: null,
            id: { notIn: alreadyNudgedIds },
            teamId: { notIn: throttledTeamIds },
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
            sequence: { select: { name: true, _count: { select: { steps: true } } } },
            lead: {
                select: {
                    phone: true,
                    whatsappConsent: true,
                    messages: {
                        where: { direction: "INBOUND" },
                        orderBy: { createdAt: "desc" },
                        take: 1,
                        select: { createdAt: true }
                    },
                    replies: {
                        orderBy: { receivedAt: "desc" },
                        take: 1,
                        select: { receivedAt: true, aiClassification: true, humanCorrection: true }
                    }
                }
            }
        }
    });

    if (stalled.length === 0) {
        return { candidates: 0, nudgesCreated: 0 };
    }

    // Batched, not per-candidate: same shape as the throttle/dedup lookups above,
    // one query for every team in this tick's batch rather than N. Filtered in JS
    // (not the where clause) to match teamHasWaba()'s own truthiness check exactly
    // rather than juggling Prisma's DbNull-vs-JsonNull semantics for this Json field.
    const teamIds = [...new Set(stalled.map((e) => e.teamId))];
    const teams = await prisma.team.findMany({
        where: { id: { in: teamIds } },
        select: { id: true, whatsappPhoneNumberId: true, whatsappAccessTokenEnc: true }
    });
    const wabaTeamIds = new Set(teams.filter((t) => !!t.whatsappPhoneNumberId && !!t.whatsappAccessTokenEnc).map((t) => t.id));

    // Per-team Jev switches (see stallJudgment.ts): one read for the whole tick.
    const jevFlags = await prisma.featureFlag.findMany({
        where: { isEnabled: true, key: { in: teamIds.flatMap((id) => Object.values(stallJevFlagKeys(id))) } },
        select: { key: true }
    });
    const jevFlagKeys = new Set(jevFlags.map((f) => f.key));
    const jevModeByTeam = new Map(
        teamIds.map((id) => {
            const keys = stallJevFlagKeys(id);
            return [id, stallJevMode({ on: jevFlagKeys.has(keys.on), shadow: jevFlagKeys.has(keys.shadow) })] as const;
        })
    );

    const now = Date.now();
    const candidates: StallCandidate[] = stalled.map((enrollment) => {
        const anchor = enrollment.lastRunAt || enrollment.startedAt;
        const stallDays = (now - anchor.getTime()) / MS_PER_DAY;
        const totalSteps = enrollment.sequence._count.steps;
        // Only a reply since this enrollment started says anything about it.
        const latestReply = enrollment.lead?.replies?.[0];
        const lastInbound = enrollment.lead?.messages?.[0]?.createdAt;
        // receivedAt is stamped when the classifier saves the row, so it can postdate an older reply;
        // the inbound message time is what places the reply inside this enrollment.
        const replyInEnrollment = latestReply && latestReply.receivedAt >= enrollment.startedAt && !!lastInbound && lastInbound >= enrollment.startedAt ? latestReply : null;
        return {
            enrollmentId: enrollment.id,
            sequenceName: enrollment.sequence.name,
            stage: totalSteps > 0 ? `step ${enrollment.currentStepOrder + 1} of ${totalSteps}` : `step ${enrollment.currentStepOrder + 1}`,
            stallDays,
            whatsappEligible: wabaTeamIds.has(enrollment.teamId) && !!enrollment.lead?.phone && enrollment.lead?.whatsappConsent === true,
            replied: !!replyInEnrollment || (!!lastInbound && lastInbound >= enrollment.startedAt),
            replyClassification: replyInEnrollment ? replyInEnrollment.humanCorrection || replyInEnrollment.aiClassification : null
        };
    });

    const byEnrollmentId = new Map(stalled.map((e) => [e.id, e]));

    // Teams with the Jev judgment on (or in shadow) go through judgeStalledEnrollmentsWithJev; every
    // other candidate gets the rules exactly as before.
    const rulesOnly: StallCandidate[] = [];
    const jevInputs: StallJevInput[] = [];
    for (const candidate of candidates) {
        const enrollment = byEnrollmentId.get(candidate.enrollmentId)!;
        const mode: StallJevMode = jevModeByTeam.get(enrollment.teamId) ?? "off";
        if (mode === "off") {
            rulesOnly.push(candidate);
            continue;
        }
        jevInputs.push({ candidate, teamId: enrollment.teamId, thread: await loadStallThread(enrollment.teamId, enrollment.leadId), mode });
    }

    const judgments = judgeStalledEnrollments(rulesOnly);
    if (jevInputs.length > 0) {
        const jev = await judgeStalledEnrollmentsWithJev(jevInputs);
        judgments.push(...jev.judgments);
        for (const log of jev.logs) {
            logger.info("[Overseer] Stall judgment", { ...log });
        }
    }

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

/**
 * The last few messages of one lead, oldest first, masked for Jev. Team-scoped: a lead that
 * isn't on this team reads as an empty thread. Inbound messages are the lead's side; our sent
 * messages come from both Message (outbound) and Email (sequence sends).
 */
async function loadStallThread(teamId: string, leadId: string): Promise<StallThreadMessage[]> {
    const lead = await prisma.lead.findFirst({
        where: { id: leadId, teamId },
        select: {
            fullName: true,
            company: true,
            messages: {
                orderBy: { createdAt: "desc" },
                take: STALL_THREAD_MESSAGES,
                select: { direction: true, content: true, createdAt: true }
            },
            emails: {
                orderBy: { createdAt: "desc" },
                take: STALL_THREAD_MESSAGES,
                select: { subject: true, body: true, createdAt: true }
            }
        }
    });
    if (!lead) return [];

    const entries = [
        ...lead.messages.map((m) => ({ at: m.createdAt, from: m.direction === "INBOUND" ? ("lead" as const) : ("us" as const), text: toPlainText(m.content) })),
        ...lead.emails.map((e) => ({ at: e.createdAt, from: "us" as const, text: `Subject: ${e.subject}\n${toPlainText(e.body)}` }))
    ]
        .sort((a, b) => a.at.getTime() - b.at.getTime())
        .slice(-STALL_THREAD_MESSAGES);

    const names = { person: lead.fullName, company: lead.company };
    return Promise.all(entries.map(async (e) => ({ from: e.from, text: await maskForJev(e.text, names) })));
}

// Same masking as the reply analyzer: this text goes to a third-party model.
async function maskForJev(text: string, names: { person?: string | null; company?: string | null }): Promise<string> {
    const { safeContext } = await SovereignFirewall.mask(text, "GLOBAL", undefined, { alwaysMask: true });
    return SovereignFirewall.maskKnownNames(safeContext, names).safeContext;
}
