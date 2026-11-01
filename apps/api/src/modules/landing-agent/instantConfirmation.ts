import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { nurtureCanRunSteps, whatsappStepProblem } from "@/modules/creator-funnel/nurtureProvider";
import { consentAllowsContact } from "./leadConsent";
import { instantConfirmationSchema, type InstantConfirmation } from "./schemas";

// Phase 9 instant confirmation: after a landing form lead is stored, the page's chosen sequence sends that
// lead ONE message through the existing nurture provider (one sender per lead). The copy is the sequence
// step's own subject/body, edited in the sequence editor. Consent, do-not-contact and suppression are checked here.

export type ConfirmationChannel = "email" | "whatsapp";

type ConfirmationStep = {
    stepType: string;
    body: string | null;
    whatsappTemplateName: string | null;
    whatsappTemplateLanguage: string | null;
};

type LoadedSequence =
    | { ok: true; sequenceId: string; channel: ConfirmationChannel; step: ConfirmationStep; senderMailboxIds: string[] }
    | { ok: false; message: string };

const refuse = (message: string) => ({ ok: false as const, message });

// Only a draft or an active sequence can be used. Paused or stopped ones must not restart when a lead signs up.
const RUNNABLE_STATUSES = ["DRAFT", "ACTIVE"];

// The channel of a sequence whose only active step is an email or an approved WhatsApp template step, or null.
function channelOfSingleStep(steps: ConfirmationStep[]): ConfirmationChannel | null {
    if (steps.length !== 1) return null;
    const [step] = steps;
    const kind = step.stepType.trim().toLowerCase();
    const channel: ConfirmationChannel | null = kind === "whatsapp" ? "whatsapp" : kind === "email" ? "email" : null;
    return channel && nurtureCanRunSteps([step]) ? channel : null;
}

// The page's stored setting, or null when it is off or unreadable. Existing pages store nothing, so they stay off.
export function instantConfirmationOf(value: unknown): InstantConfirmation | null {
    const parsed = instantConfirmationSchema.safeParse(value);
    return parsed.success && parsed.data.enabled ? parsed.data : null;
}

// Structural check, run at save time and again before each send: team-scoped, exactly one active step,
// and that step is an email or an approved WhatsApp template step that a nurture can run.
async function loadSequence(teamId: string, sequenceId: string): Promise<LoadedSequence> {
    const sequence = await prisma.campaignSequence.findFirst({
        where: { id: sequenceId, teamId },
        select: {
            id: true,
            status: true,
            senderMailboxIds: true,
            steps: {
                where: { status: "ACTIVE" },
                select: { stepType: true, body: true, whatsappTemplateName: true, whatsappTemplateLanguage: true },
            },
        },
    });
    if (!sequence) return refuse("That sequence isn't in this team.");
    if (!RUNNABLE_STATUSES.includes(sequence.status)) return refuse("Only a draft or active sequence can be used.");
    if (sequence.steps.length !== 1) return refuse("Pick a sequence with exactly one active step.");
    const [step] = sequence.steps;
    const channel = channelOfSingleStep(sequence.steps);
    if (!channel) return refuse("The one step must be an email, or a WhatsApp step that uses an approved template.");
    return { ok: true, sequenceId: sequence.id, channel, step, senderMailboxIds: sequence.senderMailboxIds };
}

// The team's sequences that can be picked for instant confirmation, for the page settings picker.
export type InstantConfirmationSequence = {
    id: string;
    name: string;
    channel: ConfirmationChannel;
    status: "DRAFT" | "ACTIVE";
    campaignId: string | null;
};

export async function listInstantConfirmationSequences(teamId: string): Promise<InstantConfirmationSequence[]> {
    const sequences = await prisma.campaignSequence.findMany({
        where: { teamId },
        orderBy: { createdAt: "asc" },
        select: {
            id: true,
            name: true,
            status: true,
            campaignId: true,
            steps: {
                where: { status: "ACTIVE" },
                select: { stepType: true, body: true, whatsappTemplateName: true, whatsappTemplateLanguage: true },
            },
        },
    });
    return sequences.flatMap((sequence) => {
        const channel = RUNNABLE_STATUSES.includes(sequence.status) ? channelOfSingleStep(sequence.steps) : null;
        // Only DRAFT or ACTIVE reach here (RUNNABLE_STATUSES), so the status narrowing is safe.
        return channel ? [{ id: sequence.id, name: sequence.name, channel, status: sequence.status as "DRAFT" | "ACTIVE", campaignId: sequence.campaignId }] : [];
    });
}

// Save-time validation of the chosen sequence. Returns the channel, or why it can't be used.
export async function checkConfirmationSequence(
    teamId: string,
    sequenceId: string,
): Promise<{ ok: true; channel: ConfirmationChannel } | { ok: false; message: string }> {
    const loaded = await loadSequence(teamId, sequenceId);
    if (!loaded.ok) return loaded;
    if (loaded.channel === "email") {
        if (!loaded.step.body?.trim()) return refuse("The email step needs a body.");
        if (loaded.senderMailboxIds.length === 0) return refuse("Set a sender mailbox on that sequence first.");
    } else {
        const problem = await whatsappStepProblem(teamId, [loaded.step]);
        if (problem) return refuse(problem);
    }
    return { ok: true, channel: loaded.channel };
}

// Intake hook: enrolls the lead in the page's confirmation sequence. Sends only when the form had no consent
// box or it was ticked, the lead is not do-not-contact or suppressed, and the lead is not already in a sequence
// (a retry or the launch-plan nurture). Best-effort: never throws, so the intake job is never failed by it.
export async function sendInstantConfirmation(
    landingLead: { teamId: string; rawPayload?: unknown; landingPage?: { instantConfirmation?: unknown } | null },
    leadId: string,
): Promise<void> {
    const setting = instantConfirmationOf(landingLead.landingPage?.instantConfirmation);
    if (!setting) return;
    const { teamId } = landingLead;
    const skip = (reason: string) => logger.info(`[InstantConfirmation] Skipped for lead ${leadId}: ${reason}`);
    try {
        if (!consentAllowsContact(landingLead.rawPayload)) return skip("consent not given");
        const lead = await prisma.lead.findFirst({
            where: { id: leadId, teamId },
            select: { email: true, phone: true, status: true, whatsappConsent: true },
        });
        if (!lead) return skip("lead not found");
        if (lead.status === "DNC") return skip("do not contact");
        const loaded = await loadSequence(teamId, setting.sequenceId);
        if (!loaded.ok) {
            logger.warn(`[InstantConfirmation] Sequence ${setting.sequenceId} can't send for lead ${leadId}: ${loaded.message}`);
            return;
        }
        if (loaded.channel === "email") {
            if (!lead.email) return skip("no email address");
            const { isSuppressed } = await import("@/modules/email-campaigner/service/googleMailboxService");
            if (await isSuppressed(teamId, lead.email)) return skip("email is suppressed");
        } else if (!lead.whatsappConsent || !lead.phone) {
            return skip("no WhatsApp consent or phone number");
        }
        const { enrollInNurture, teamNurtureProvider } = await import("@/modules/creator-funnel/nurtureProvider");
        const provider = await teamNurtureProvider(teamId);
        if ((await provider.status({ id: leadId, teamId })).active) return skip("already in a sequence");
        await enrollInNurture(teamId, leadId, loaded.sequenceId);
    } catch (error) {
        logger.warn(`[InstantConfirmation] Failed for lead ${leadId}: ${error instanceof Error ? error.message : error}`);
    }
}
