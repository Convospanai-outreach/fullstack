import type { FunnelStage, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";

// The email sequences a launch plan drafts (spec phase 5c). Each sequence gets its own draft
// Campaign, because the campaign editor edits one sequence per campaign. Nothing here enrolls
// anyone: sequences stay DRAFT, and a lead joins one only through a switch someone turns on later.
// - nurture (MOFU): delivers the lead magnet, teaches, then invites to the offer; a booking offer
//   ends with the call-booking emails (there's no checkout event to start a separate one).
// - cartAbandon (BOFU, product offers): reminders with the checkout link.
// - postPurchase (POST, product offers): a testimonial request a week after buying. The delivery
//   email already goes out from the product's own automation, so it isn't repeated here.
// Links are added by code, never written by the AI.

export type SequenceKind = "nurture" | "cartAbandon" | "postPurchase";
type CampaignColumn = "nurtureCampaignId" | "cartAbandonCampaignId" | "postPurchaseCampaignId";
export const SEQUENCE_SLOT: Record<SequenceKind, { column: CampaignColumn; stage: FunnelStage; label: string }> = {
    nurture: { column: "nurtureCampaignId", stage: "MOFU", label: "nurture emails" },
    cartAbandon: { column: "cartAbandonCampaignId", stage: "BOFU", label: "checkout reminders" },
    postPurchase: { column: "postPurchaseCampaignId", stage: "POST", label: "after purchase" },
};

export type SequenceRun = {
    id: string;
    teamId: string;
    name: string;
    createdById: string | null;
    icpId: string | null;
    nurtureCampaignId: string | null;
    cartAbandonCampaignId: string | null;
    postPurchaseCampaignId: string | null;
};

type EmailSpec = { delayDays: number; brief: string; link: { href: string; label: string } | null };
export type SequenceSpec = { kind: SequenceKind; emails: EmailSpec[] };

/** What each sequence's emails are about, and the link each one ends with. */
export function sequenceSpecs(input: {
    leadMagnet: string;
    booking: boolean;
    bookingUrl: string | null;
    salesPageUrl: string | null;
    checkoutUrl: string | null;
}): SequenceSpec[] {
    const offerLink = input.booking
        ? input.bookingUrl && { href: input.bookingUrl, label: "Book your call" }
        : input.salesPageUrl && { href: input.salesPageUrl, label: "See the details" };
    const nurture: SequenceSpec = {
        kind: "nurture",
        emails: [
            { delayDays: 0, brief: `Deliver the free lead magnet they just asked for: write the ${input.leadMagnet} itself, short and usable today.`, link: null },
            { delayDays: 2, brief: "Teach one more practical idea that builds on the lead magnet.", link: null },
            { delayDays: 3, brief: "Show how the offer helps with the problem, and invite them to take the next step.", link: offerLink || null },
            ...(input.booking
                ? [{ delayDays: 3, brief: "A short, friendly last reminder that they can book a call, with no pressure.", link: offerLink || null }]
                : []),
        ],
    };
    if (input.booking || !input.checkoutUrl) return [nurture];
    const checkout = { href: input.checkoutUrl, label: "Finish your order" };
    return [
        nurture,
        {
            kind: "cartAbandon",
            emails: [
                { delayDays: 0, brief: "They started checking out but didn't finish. A helpful reminder, answering a likely doubt.", link: checkout },
                { delayDays: 1, brief: "A last, short nudge to finish the order.", link: checkout },
            ],
        },
        {
            kind: "postPurchase",
            emails: [{ delayDays: 7, brief: "They bought a week ago. Ask how it's going and for a short testimonial they can send by replying.", link: null }],
        },
    ];
}

const emailSchema = z.object({ subject: z.string().min(1), body: z.string().min(1) });

export type EmailWriter = (prompt: string) => Promise<string>;

export function buildEmailPrompt(context: string[], spec: EmailSpec, index: number, total: number, kind: SequenceKind) {
    return [
        `You write one email in a creator's ${SEQUENCE_SLOT[kind].label} sequence.`,
        ...context,
        "",
        `This is email ${index + 1} of ${total}. Goal: ${spec.brief}`,
        "Plain text, at most 180 words, short paragraphs separated by a blank line. Write like a person, not a brand.",
        ...(spec.link ? ["End with one sentence leading to a link; the link is added below your text, so don't write it."] : []),
        "Don't include links or URLs, placeholders like [Name], prices, numbers or testimonials that aren't given above.",
        'Return JSON only: {"subject":"...","body":"..."}',
    ].join("\n");
}

const escapeHtml = (value: string) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** The sequence engine sends a step's body as HTML: paragraphs of escaped text, then the link. */
export function emailHtml(text: string, link: EmailSpec["link"]) {
    const paragraphs = text
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`);
    if (link) paragraphs.push(`<p><a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a></p>`);
    return paragraphs.join("\n");
}

async function writeEmail(write: EmailWriter, extractJson: (raw: string) => string, context: string[], spec: SequenceSpec, i: number) {
    const raw = await write(buildEmailPrompt(context, spec.emails[i]!, i, spec.emails.length, spec.kind));
    const email = emailSchema.parse(JSON.parse(extractJson(raw)));
    return { subject: [...email.subject.trim()].slice(0, 200).join(""), body: emailHtml([...email.body.trim()].slice(0, 4000).join(""), spec.emails[i]!.link) };
}

/**
 * Writes one sequence's emails and saves it as a draft Campaign with a DRAFT CampaignSequence, in
 * one transaction that also records the campaign on the run, so a retry carries on instead of
 * making a second copy. Returns the campaign id.
 */
export async function ensureSequence(
    run: SequenceRun,
    spec: SequenceSpec,
    ai: { write: EmailWriter; extractJson: (raw: string) => string; context: string[]; timezone: string },
): Promise<string> {
    const slot = SEQUENCE_SLOT[spec.kind];
    const existing = run[slot.column];
    if (existing) return existing;
    const emails = await Promise.all(spec.emails.map((_, i) => writeEmail(ai.write, ai.extractJson, ai.context, spec, i)));
    const name = `${[...run.name].slice(0, 80).join("")}: ${slot.label}`;
    const campaignId = await prisma.$transaction(async (tx) => {
        const campaign = await tx.campaign.create({
            data: {
                teamId: run.teamId,
                ownerId: run.createdById,
                icpId: run.icpId,
                name,
                description: `Drafted by the launch plan "${[...run.name].slice(0, 120).join("")}". Nothing is sent until it's switched on.`,
                status: "draft",
            },
            select: { id: true },
        });
        const sequence = await tx.campaignSequence.create({
            data: { teamId: run.teamId, campaignId: campaign.id, name, status: "DRAFT", timezone: ai.timezone, funnelStage: slot.stage },
            select: { id: true },
        });
        await tx.sequenceStep.createMany({
            data: emails.map((email, i) => ({
                teamId: run.teamId,
                sequenceId: sequence.id,
                stepOrder: i,
                stepType: "EMAIL",
                delayDays: spec.emails[i]!.delayDays,
                subject: email.subject,
                body: email.body,
            })),
        });
        const saved = await tx.playbookRun.updateMany({
            where: { id: run.id, status: "GENERATING" },
            data: { [slot.column]: campaign.id } as Prisma.PlaybookRunUpdateManyMutationInput,
        });
        if (saved.count !== 1) throw new Error("run is no longer being written");
        return campaign.id;
    }, { timeout: 20_000 });
    run[slot.column] = campaignId;
    return campaignId;
}

/** The plan's sequences for review: campaign, stage, each email's delay and subject, and how many leads joined. */
export async function planSequences(teamId: string, campaignIds: (string | null)[]) {
    const ids = campaignIds.filter((id): id is string => Boolean(id));
    if (!ids.length) return [];
    return prisma.campaignSequence.findMany({
        where: { teamId, campaignId: { in: ids } },
        select: {
            id: true, campaignId: true, name: true, status: true, funnelStage: true,
            steps: { orderBy: { stepOrder: "asc" }, select: { delayDays: true, subject: true } },
            _count: { select: { enrollments: true } },
        },
        orderBy: { createdAt: "asc" },
    });
}

/**
 * The sequence part of deleting a plan. A sequence anyone has joined, or one a product with its
 * automations on sends, stays with its campaign. Otherwise a product that merely points at it is
 * unpointed, and the sequence and its campaign go (only while the campaign has no emails or leads).
 */
export async function deleteSequences(run: Pick<SequenceRun, "teamId" | "nurtureCampaignId" | "cartAbandonCampaignId" | "postPurchaseCampaignId">) {
    let sequencesDeleted = 0;
    let sequencesKept = 0;
    for (const campaignId of [run.nurtureCampaignId, run.cartAbandonCampaignId, run.postPurchaseCampaignId]) {
        if (!campaignId) continue;
        const sequences = await prisma.campaignSequence.findMany({
            where: { teamId: run.teamId, campaignId },
            select: { id: true, _count: { select: { enrollments: true } } },
        });
        const ids = sequences.map((s) => s.id);
        const live = ids.length
            ? await prisma.product.count({ where: { teamId: run.teamId, automationsActive: true, cartAbandonSequenceId: { in: ids } } })
            : 0;
        if (live || sequences.some((s) => s._count.enrollments > 0)) {
            sequencesKept++;
            continue;
        }
        if (ids.length) {
            await prisma.product.updateMany({
                where: { teamId: run.teamId, automationsActive: false, cartAbandonSequenceId: { in: ids } },
                data: { cartAbandonSequenceId: null, cartAbandonHours: null },
            });
            await prisma.campaignSequence.deleteMany({ where: { teamId: run.teamId, id: { in: ids }, enrollments: { none: {} } } });
        }
        // Conditional, so a campaign someone started using in the meantime is never deleted.
        const res = await prisma.campaign.deleteMany({
            where: { id: campaignId, teamId: run.teamId, sequences: { none: {} }, emails: { none: {} }, leadList: { none: {} }, sequenceEnrollments: { none: {} } },
        });
        if (res.count) sequencesDeleted++;
        else sequencesKept++;
    }
    return { sequencesDeleted, sequencesKept };
}
