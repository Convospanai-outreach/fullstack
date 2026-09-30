import type { NurtureOwner } from "@prisma/client";
import { prisma } from "@/lib/db";

// Seam between creator-funnel logic and whichever system sends marketing nurture. Today every
// team uses CMf sequences; Mautic journeys slot in behind the same interface once Mautic is live.
// One sender per lead: Lead.nurtureOwner records who owns it, and enrolling with the other
// provider stops the first one before starting. Replies already stop CMf sequences (the
// sequence engine exits a lead whose status is "replied"), which pauses nurture during a
// 1:1 conversation.

export type NurtureLead = { id: string; teamId: string };

export interface NurtureProvider {
    readonly key: NurtureOwner;
    enroll(lead: NurtureLead, journeyKey: string): Promise<void>;
    stop(lead: NurtureLead, reason: string): Promise<void>;
    status(lead: NurtureLead): Promise<{ active: boolean }>;
}

export class NurtureNotConfiguredError extends Error {
    constructor() {
        super("Mautic journeys aren't set up yet");
        this.name = "NurtureNotConfiguredError";
    }
}

// Mirrors apps/web lib/campaigns/enrollment.ts: the only step types the sequence engine runs.
const SUPPORTED_STEP_TYPES = new Set(["email", "condition", "delay", "manual_review"]);
const LIVE_ENROLLMENT_STATUSES = ["ACTIVE", "SCHEDULING", "MANUAL_REVIEW"];

/** CMf sequences. journeyKey is a CampaignSequence id in the lead's team. */
export class CmfSequenceProvider implements NurtureProvider {
    readonly key = "CMF" as const;

    async enroll(lead: NurtureLead, journeyKey: string) {
        const sequence = await prisma.campaignSequence.findFirst({
            where: { id: journeyKey, teamId: lead.teamId },
            include: { steps: { where: { status: "ACTIVE" }, orderBy: { stepOrder: "asc" } } },
        });
        const firstStep = sequence?.steps[0];
        if (!sequence || !firstStep) throw new Error("Nurture sequence not found or has no active steps");
        const unsupported = sequence.steps.find((step) => !SUPPORTED_STEP_TYPES.has(step.stepType.trim().toLowerCase().replace(/-/g, "_")));
        if (unsupported) throw new Error(`Nurture sequence step "${unsupported.stepType}" can't run yet`);

        const mailbox = sequence.senderMailboxIds.length
            ? await prisma.connectedMailbox.findFirst({
                  where: { id: { in: sequence.senderMailboxIds }, teamId: lead.teamId, status: "CONNECTED" },
                  select: { id: true },
              })
            : null;
        const now = new Date();
        await prisma.sequenceEnrollment.createMany({
            data: [{
                teamId: lead.teamId,
                sequenceId: sequence.id,
                leadId: lead.id,
                campaignId: sequence.campaignId,
                status: "ACTIVE",
                currentStepOrder: 0,
                nextRunAt: new Date(now.getTime() + (firstStep.delayDays * 24 + firstStep.delayHours) * 60 * 60 * 1000),
                ...(mailbox ? { mailboxId: mailbox.id } : {}),
            }],
            skipDuplicates: true,
        });
        if (sequence.status !== "ACTIVE") {
            await prisma.campaignSequence.update({ where: { id: sequence.id }, data: { status: "ACTIVE" } });
        }
    }

    async stop(lead: NurtureLead, reason: string) {
        const { SequenceService } = await import("@/modules/email-campaigner/service/sequenceService");
        await SequenceService.stopEnrollmentsForLead(lead.teamId, lead.id, `EXIT_NURTURE_${reason.toUpperCase()}`);
    }

    async status(lead: NurtureLead) {
        const live = await prisma.sequenceEnrollment.count({
            where: { teamId: lead.teamId, leadId: lead.id, status: { in: LIVE_ENROLLMENT_STATUSES } },
        });
        return { active: live > 0 };
    }
}

/** Placeholder until Mautic infra is live: every call fails with NurtureNotConfiguredError. */
export class MauticJourneyProvider implements NurtureProvider {
    readonly key = "MAUTIC" as const;

    async enroll(): Promise<void> {
        throw new NurtureNotConfiguredError();
    }

    async stop(): Promise<void> {
        throw new NurtureNotConfiguredError();
    }

    async status(): Promise<{ active: boolean }> {
        throw new NurtureNotConfiguredError();
    }
}

export function providerFor(owner: NurtureOwner): NurtureProvider {
    return owner === "MAUTIC" ? new MauticJourneyProvider() : new CmfSequenceProvider();
}

export async function teamNurtureProvider(teamId: string) {
    const team = await prisma.team.findUnique({ where: { id: teamId }, select: { nurtureProvider: true } });
    return providerFor(team?.nurtureProvider ?? "CMF");
}

async function findLead(teamId: string, leadId: string) {
    const lead = await prisma.lead.findFirst({ where: { id: leadId, teamId }, select: { id: true, teamId: true, nurtureOwner: true } });
    if (!lead) throw new Error("Lead not found");
    return { lead: { id: lead.id, teamId }, owner: lead.nurtureOwner };
}

/**
 * Enrolls the lead with the team's provider. If another provider owns the lead, that one is
 * stopped first; if it can't be stopped, nothing is enrolled (never two senders at once).
 */
export async function enrollInNurture(teamId: string, leadId: string, journeyKey: string) {
    const { lead, owner } = await findLead(teamId, leadId);
    const provider = await teamNurtureProvider(teamId);
    if (owner && owner !== provider.key) {
        await providerFor(owner).stop(lead, "switched_provider");
        await prisma.lead.updateMany({ where: { id: leadId, teamId }, data: { nurtureOwner: null } });
    }
    await provider.enroll(lead, journeyKey);
    await prisma.lead.updateMany({ where: { id: leadId, teamId }, data: { nurtureOwner: provider.key } });
    return { owner: provider.key };
}

/** Stops whichever provider owns the lead's nurture (e.g. after purchase) and clears the owner. */
export async function stopNurture(teamId: string, leadId: string, reason: string) {
    const { lead, owner } = await findLead(teamId, leadId);
    if (!owner) return { stopped: false };
    await providerFor(owner).stop(lead, reason);
    await prisma.lead.updateMany({ where: { id: leadId, teamId }, data: { nurtureOwner: null } });
    return { stopped: true };
}
