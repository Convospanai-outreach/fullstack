/**
 * Shared campaign-sequence enrollment.
 *
 * Extracted from routes/api/campaigns/[id]/sequence/enroll so the same logic
 * backs both that route and the unified POST /campaigns/[id]/start action
 * (roadmap 2.12 / B-12). Callers must have already authenticated the request
 * and confirmed the campaign belongs to `teamId`.
 */

// Must mirror sequenceService.ts's normalize()/stepType() on apps/api exactly: trim, lowercase,
// hyphens to underscores. That engine only ever advances these four types; anything else hard-fails
// a step run with UNSUPPORTED_STEP_TYPE and leaves the enrollment stuck in "SCHEDULING" forever,
// with no automated exit or retry - so this must be an allowlist of what's known-safe, not a
// denylist of LinkedIn step names (older rows can carry other stray/legacy values entirely).
const SUPPORTED_STEP_TYPES = new Set(["email", "condition", "delay", "manual_review"]);

function normalizedStepType(stepType: string) {
    return stepType.trim().toLowerCase().replace(/-/g, "_");
}

function firstStepDelayMs(step: { delayDays: number; delayHours: number }) {
    return (step.delayDays * 24 + step.delayHours) * 60 * 60 * 1000;
}

export type EnrollResult =
    | { ok: true; candidates: number; enrolled: number; alreadyEnrolled: number; message?: string }
    | { ok: false; code: "NO_SEQUENCE" | "UNSUPPORTED_STEP"; error: string };

/**
 * Enrol every lead assigned to a campaign into its (first) saved sequence.
 * Returns a discriminated result rather than an HTTP response so both the
 * sequence/enroll route and the /start route can map it to their own shape.
 * `NO_SEQUENCE` lets /start fall back to the direct-draft path.
 */
export async function enrollCampaignLeads(campaignId: string, teamId: string): Promise<EnrollResult> {
    const { prisma } = await import("@/lib/db");

    const sequence = await prisma.campaignSequence.findFirst({
        where: { campaignId, teamId },
        orderBy: { createdAt: "asc" },
        include: { steps: { where: { status: "ACTIVE" }, orderBy: { stepOrder: "asc" } } },
    });
    if (!sequence || sequence.steps.length === 0) {
        return { ok: false, code: "NO_SEQUENCE", error: "This campaign has no sequence steps to enroll leads into" };
    }

    const unsupportedStep = sequence.steps.find((s) => !SUPPORTED_STEP_TYPES.has(normalizedStepType(s.stepType)));
    if (unsupportedStep) {
        return {
            ok: false,
            code: "UNSUPPORTED_STEP",
            error: `Cannot enroll leads yet: step ${unsupportedStep.stepOrder + 1} ("${unsupportedStep.stepType}") is not a type sequence execution supports (only email/condition/delay/manual_review). Remove or replace it before enrolling.`,
        };
    }

    const leads = await prisma.lead.findMany({
        where: { campaignId, teamId },
        select: { id: true },
    });
    if (leads.length === 0) {
        return { ok: true, candidates: 0, enrolled: 0, alreadyEnrolled: 0, message: "No leads are assigned to this campaign" };
    }

    // The builder's "Select senders" step (SenderScheduleNode) persists sequence.senderMailboxIds,
    // but nothing downstream read it until now - executeEmailRun() always fell back to whichever
    // connected mailbox selectMailboxForSend rotated to next, silently ignoring an operator's
    // choice to send this sequence through a specific (e.g. Resend) mailbox. Re-validate the
    // selection against currently-connected mailboxes and distribute leads round-robin across it.
    const senderMailboxIds = sequence.senderMailboxIds || [];
    const selectedMailboxes = senderMailboxIds.length > 0
        ? await prisma.connectedMailbox.findMany({
              where: { id: { in: senderMailboxIds }, teamId, status: "CONNECTED" },
              select: { id: true },
          })
        : [];

    const now = new Date();
    const firstStep = sequence.steps[0]!;
    const nextRunAt = new Date(now.getTime() + firstStepDelayMs(firstStep));
    const result = await prisma.sequenceEnrollment.createMany({
        data: leads.map((lead, index) => ({
            teamId,
            sequenceId: sequence.id,
            leadId: lead.id,
            campaignId,
            status: "ACTIVE",
            currentStepOrder: 0,
            nextRunAt,
            ...(selectedMailboxes.length > 0
                ? { mailboxId: selectedMailboxes[index % selectedMailboxes.length]!.id }
                : {}),
        })),
        skipDuplicates: true,
    });

    if (sequence.status !== "ACTIVE") {
        await prisma.campaignSequence.update({ where: { id: sequence.id }, data: { status: "ACTIVE" } });
    }

    return {
        ok: true,
        candidates: leads.length,
        enrolled: result.count,
        alreadyEnrolled: leads.length - result.count,
    };
}
