import { z } from "zod";
import { prisma } from "@/lib/db";
import { ContentPostError } from "./contentPostService";
import { nurtureCanRunSteps } from "./nurtureProvider";

// Turning a launch plan's email sequences on (spec phase 5c-1b). The plan drafts them switched
// off (playbookSequences.ts); these are the explicit steps that let them send:
// - the nurture switch: new sign-ups on the plan's lead-magnet page join the nurture sequence.
//   Who switched it on and when is recorded, which is the approval for those sends. Switching off
//   stops new sign-ups joining; people already in it carry on (stop them from the campaign).
// - "use on the product": points the product's cart-abandon and after-purchase automations at the
//   plan's sequences. It only fills empty fields of a product whose automations are off, so it never
//   starts sends itself: those start when someone switches the product on in Settings > Payments.
// Both pick the team mailbox the emails go from (never the system sender).

export const nurtureSwitchSchema = z.object({
    active: z.boolean(),
    mailboxId: z.string().max(64).optional(),
});
export const useOnProductSchema = z.object({ mailboxId: z.string().max(64) });

/** Hours a checkout waits before the plan's reminders start (the product setting can change it). */
export const PLAN_CART_ABANDON_HOURS = 2;

const fail = (status: number, message: string): never => {
    throw new ContentPostError(status, message);
};

async function findRun(teamId: string, runId: string) {
    const run = await prisma.playbookRun.findFirst({
        where: { id: runId, teamId },
        select: { id: true, status: true, productId: true, nurtureCampaignId: true, cartAbandonCampaignId: true, postPurchaseCampaignId: true },
    });
    if (!run) fail(404, "Plan not found");
    if (run!.status !== "READY") fail(409, "The plan isn't finished yet.");
    return run!;
}

/** The plan's sequence in that campaign, checked to be one a nurture can run. */
async function runnableSequence(teamId: string, campaignId: string | null, what: string) {
    if (!campaignId) return null;
    const sequence = await prisma.campaignSequence.findFirst({
        where: { teamId, campaignId },
        orderBy: { createdAt: "asc" },
        select: { id: true, steps: { where: { status: "ACTIVE" }, select: { stepType: true } } },
    });
    if (!sequence) return null;
    if (!nurtureCanRunSteps(sequence.steps.map((s) => s.stepType))) {
        fail(400, `The ${what} sequence has no steps, or has steps a nurture can't run yet (email, delay, condition and manual review only).`);
    }
    return sequence.id;
}

async function assertMailbox(teamId: string, mailboxId: string | undefined) {
    if (!mailboxId) fail(400, "Pick the mailbox the emails go from.");
    const mailbox = await prisma.connectedMailbox.findFirst({ where: { id: mailboxId!, teamId, status: "CONNECTED" }, select: { id: true } });
    if (!mailbox) fail(400, "That mailbox isn't connected.");
}

export async function setPlanNurture(teamId: string, userId: string, runId: string, input: z.infer<typeof nurtureSwitchSchema>) {
    const run = await findRun(teamId, runId);
    if (!input.active) {
        await prisma.playbookRun.updateMany({ where: { id: run.id, teamId }, data: { nurtureActivatedAt: null, nurtureActivatedById: null } });
        return { active: false };
    }
    const sequenceId = await runnableSequence(teamId, run.nurtureCampaignId, "nurture");
    if (!sequenceId) fail(409, "This plan has no nurture sequence.");
    await assertMailbox(teamId, input.mailboxId);
    await prisma.campaignSequence.updateMany({ where: { id: sequenceId!, teamId }, data: { senderMailboxIds: [input.mailboxId!] } });
    await prisma.playbookRun.updateMany({ where: { id: run.id, teamId }, data: { nurtureActivatedAt: new Date(), nurtureActivatedById: userId } });
    return { active: true };
}

/**
 * Points the plan's product at its checkout reminder and after-purchase sequences. Each field is
 * only filled while it's empty and the product's automations are off, so nothing starts sending here.
 */
export async function useOnProduct(teamId: string, runId: string, input: z.infer<typeof useOnProductSchema>) {
    const run = await findRun(teamId, runId);
    if (!run.productId) fail(409, "This plan's offer isn't a product.");
    const product = await prisma.product.findFirst({ where: { id: run.productId!, teamId }, select: { id: true, automationsActive: true } });
    if (!product) fail(404, "The plan's product was deleted.");
    if (product!.automationsActive) fail(409, "Switch the product's automations off in Settings > Payments first, then try again.");
    await assertMailbox(teamId, input.mailboxId);
    const [cartAbandon, postPurchase] = await Promise.all([
        runnableSequence(teamId, run.cartAbandonCampaignId, "checkout reminder"),
        runnableSequence(teamId, run.postPurchaseCampaignId, "after-purchase"),
    ]);
    const ids = [cartAbandon, postPurchase].filter((id): id is string => Boolean(id));
    if (!ids.length) fail(409, "This plan has no product sequences.");
    await prisma.campaignSequence.updateMany({ where: { teamId, id: { in: ids } }, data: { senderMailboxIds: [input.mailboxId] } });
    const off = { id: product!.id, teamId, automationsActive: false };
    const set = async (done: Promise<{ count: number }> | null) => (done ? (await done).count === 1 : false);
    const result = {
        cartAbandon: await set(cartAbandon
            ? prisma.product.updateMany({ where: { ...off, cartAbandonSequenceId: null }, data: { cartAbandonSequenceId: cartAbandon, cartAbandonHours: PLAN_CART_ABANDON_HOURS } })
            : null),
        postPurchase: await set(postPurchase
            ? prisma.product.updateMany({ where: { ...off, postPurchaseSequenceId: null }, data: { postPurchaseSequenceId: postPurchase } })
            : null),
    };
    return result;
}

const PAST_NURTURE = new Set(["BOFU", "POST"]);

/**
 * Intake hook: a sign-up on a plan's lead-magnet page joins that plan's nurture when it's switched
 * on, the lead hasn't moved past nurture, and nothing else is emailing the lead right now. Returns
 * why it didn't, for the log. Throws only on unexpected errors (the caller never fails the job).
 */
export async function enrollPlanNurture(signUp: { teamId: string; landingPageId: string }, leadId: string) {
    const { teamId } = signUp;
    const run = await prisma.playbookRun.findFirst({
        where: { teamId, leadMagnetPageId: signUp.landingPageId, nurtureActivatedAt: { not: null }, nurtureCampaignId: { not: null } },
        orderBy: { nurtureActivatedAt: "desc" },
        select: { nurtureCampaignId: true },
    });
    if (!run) return "no switched-on plan for this page";
    const { isCreatorFunnelEnabled } = await import("./featureGate");
    if (!(await isCreatorFunnelEnabled(teamId))) return "creator funnel is off";
    const lead = await prisma.lead.findFirst({ where: { id: leadId, teamId }, select: { funnelStage: true } });
    if (!lead) return "lead not found";
    if (lead.funnelStage && PAST_NURTURE.has(lead.funnelStage)) return "lead is past nurture";
    const sequence = await prisma.campaignSequence.findFirst({
        where: { teamId, campaignId: run.nurtureCampaignId! },
        orderBy: { createdAt: "asc" },
        select: { id: true },
    });
    if (!sequence) return "nurture sequence was deleted";
    const { enrollInNurture, teamNurtureProvider } = await import("./nurtureProvider");
    const provider = await teamNurtureProvider(teamId);
    if ((await provider.status({ id: leadId, teamId })).active) return "lead is already in a sequence";
    await enrollInNurture(teamId, leadId, sequence.id);
    return null;
}
