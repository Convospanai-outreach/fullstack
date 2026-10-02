import crypto from "node:crypto";
import type { FunnelStage, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { JobQueue } from "@/lib/queue";
import { TaskComplexity } from "@/ai/types";
import { localDate, localTimeOn } from "@/modules/inbox/localDay";
import { isHttpsUrl } from "./checkoutHooks";
import { assertAccounts, ContentPostError, deletePost, getStageMix, INSTAGRAM_LIMITS } from "./contentPostService";
import type { PlaybookWizardInput } from "./contentRoutes";
import { createPlanTrigger, DEFAULT_KEYWORD, deleteBundle, ensurePage, triggerAccount, type BundleRun } from "./playbookBundle";
import { deleteSequences, ensureSequence, planSequences, sequenceSpecs, type SequenceRun } from "./playbookSequences";

// Creator funnel playbook wizard (spec phase 5a). One run turns an offer, an audience, a lead
// magnet, a tone and a start date into 4 weeks of DRAFT posts spread over the team's stage mix,
// each with Facebook / Instagram / LinkedIn text and a suggested visual. The AI writing runs in a
// job (playbook_generate) because it takes longer than the dashboard proxy waits. Nothing here
// publishes: drafts go through the calendar's approval flow like any other post. Everything a run
// makes points back to it (playbookRunId), so the whole set is reviewed and deleted in one place.
// 5b adds a lead-magnet page, a sales page and a switched-off keyword auto-reply (playbookBundle.ts).

export const WEEKS = 4;
const POST_HOUR = 10; // local time the drafts are scheduled at
const MAX_START_DAYS = 60;
// A run still GENERATING after this long lost its job (a deploy, a crash) and can be retried.
export const STALE_MS = 15 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const STAGES: FunnelStage[] = ["TOFU", "MOFU", "BOFU", "POST"];

export type RunInputs = PlaybookWizardInput;

const isStale = (run: { status: string; updatedAt: Date }, now: Date) =>
    run.status === "GENERATING" && now.getTime() - run.updatedAt.getTime() > STALE_MS;

/** The team's stage mix as one stage per post, spread so each stage recurs evenly across the weeks. */
export function allocateStages(mix: Record<FunnelStage, number>, count: number): FunnelStage[] {
    const total = STAGES.reduce((sum, s) => sum + Math.max(0, mix[s]), 0) || 1;
    const quota = STAGES.map((s) => (Math.max(0, mix[s]) * count) / total);
    const counts = quota.map(Math.floor);
    // Largest remainder; ties go to the earlier stage.
    const order = STAGES.map((_, i) => i).sort((a, b) => quota[b]! - counts[b]! - (quota[a]! - counts[a]!) || a - b);
    for (let left = count - counts.reduce((a, b) => a + b, 0), k = 0; left > 0; left--, k++) counts[order[k % order.length]!]! += 1;

    const used = STAGES.map(() => 0);
    const out: FunnelStage[] = [];
    for (let i = 0; i < count; i++) {
        let best = -1;
        let bestLag = -Infinity;
        STAGES.forEach((_, s) => {
            if (used[s]! >= counts[s]!) return;
            const lag = (counts[s]! * (i + 1)) / count - used[s]!;
            if (lag > bestLag) {
                bestLag = lag;
                best = s;
            }
        });
        used[best]! += 1;
        out.push(STAGES[best]!);
    }
    return out;
}

export type Slot = { week: number; stage: FunnelStage; scheduledAt: Date | null };

/** postsPerWeek slots a week for WEEKS weeks from the start date, at POST_HOUR local. Past times stay unscheduled. */
export function planSlots(inputs: Pick<RunInputs, "startDate" | "timezone" | "postsPerWeek">, mix: Record<FunnelStage, number>, now: Date): Slot[] {
    const [year, month, day] = inputs.startDate.split("-").map(Number) as [number, number, number];
    const stages = allocateStages(mix, inputs.postsPerWeek * WEEKS);
    return stages.map((stage, i) => {
        const week = Math.floor(i / inputs.postsPerWeek);
        const offset = week * 7 + Math.floor(((i % inputs.postsPerWeek) * 7) / inputs.postsPerWeek);
        const at = localTimeOn(year, month, day + offset, POST_HOUR, inputs.timezone);
        return { week, stage, scheduledAt: at.getTime() > now.getTime() ? at : null };
    });
}

function teamDayIndex(startDate: string, timezone: string, now: Date) {
    const [year, month, day] = startDate.split("-").map(Number) as [number, number, number];
    return (Date.UTC(year, month - 1, day) - localDate(now, timezone).getTime()) / DAY_MS;
}

async function enqueue(run: { id: string; teamId: string; updatedAt: Date }) {
    // One job per attempt: a retry is a new attempt, so the key carries the attempt's time.
    await JobQueue.enqueue("playbook_generate", { runId: run.id, teamId: run.teamId }, {
        teamId: run.teamId,
        idempotencyKey: `playbook_run_${run.id}_${run.updatedAt.getTime()}`,
    });
}

async function startJob(run: { id: string; teamId: string; updatedAt: Date }) {
    try {
        await enqueue(run);
    } catch (error) {
        console.error(`[PlaybookWizard] Couldn't queue run ${run.id}:`, error instanceof Error ? error.message : error);
        await prisma.playbookRun.updateMany({ where: { id: run.id, status: "GENERATING" }, data: { status: "FAILED", error: "Couldn't start writing. Try again." } });
    }
}

async function assertNoActiveRun(teamId: string, now: Date) {
    const active = await prisma.playbookRun.findFirst({
        where: { teamId, status: "GENERATING", updatedAt: { gt: new Date(now.getTime() - STALE_MS) } },
        select: { id: true },
    });
    if (active) throw new ContentPostError(409, "A plan is already being written. Wait for it to finish.");
}

export async function startRun(teamId: string, userId: string, input: RunInputs, now = new Date()) {
    const days = teamDayIndex(input.startDate, input.timezone, now);
    if (!(days >= 1 && days <= MAX_START_DAYS)) throw new ContentPostError(400, `Pick a start date from tomorrow up to ${MAX_START_DAYS} days ahead.`);

    let productId: string | null = null;
    let bookingUrl: string | null = null;
    if (input.offer.type === "product") {
        const product = await prisma.product.findFirst({ where: { id: input.offer.productId, teamId, isActive: true }, select: { id: true } });
        if (!product) throw new ContentPostError(400, "Pick one of your active products.");
        productId = product.id;
    } else {
        if (!isHttpsUrl(input.offer.bookingUrl)) throw new ContentPostError(400, "Use your booking page's full https:// link.");
        bookingUrl = input.offer.bookingUrl;
    }

    let icpId: string | null = null;
    if ("icpId" in input.audience) {
        const icp = await prisma.iCP.findFirst({ where: { id: input.audience.icpId, teamId }, select: { id: true } });
        if (!icp) throw new ContentPostError(400, "Pick one of your audiences.");
        icpId = icp.id;
    }
    await assertAccounts(teamId, input.accountIds);
    await assertNoActiveRun(teamId, now);

    const description = "description" in input.audience ? input.audience.description : null;
    const run = await prisma.$transaction(async (tx) => {
        if (description) {
            const icp = await tx.iCP.create({
                data: {
                    teamId,
                    name: `Audience: ${description.replace(/\s+/g, " ").slice(0, 60)}`,
                    description,
                    criteria: { description, source: "playbook-wizard" },
                },
                select: { id: true },
            });
            icpId = icp.id;
        }
        return tx.playbookRun.create({
            data: {
                teamId,
                createdById: userId,
                name: input.name,
                inputs: input as unknown as Prisma.InputJsonObject,
                productId,
                bookingUrl,
                icpId,
                icpCreated: Boolean(description),
            },
        });
    });
    await startJob(run);
    return run;
}

export async function retryRun(teamId: string, runId: string, now = new Date()) {
    await assertNoActiveRun(teamId, now);
    const res = await prisma.playbookRun.updateMany({
        where: {
            id: runId,
            teamId,
            OR: [{ status: "FAILED" }, { status: "GENERATING", updatedAt: { lte: new Date(now.getTime() - STALE_MS) } }],
        },
        data: { status: "GENERATING", error: null },
    });
    if (res.count !== 1) throw new ContentPostError(409, "This plan isn't waiting for a retry. Reload the page.");
    const run = await prisma.playbookRun.findFirst({ where: { id: runId, teamId }, select: { id: true, teamId: true, updatedAt: true } });
    if (run) await startJob(run);
}

// ---- Writing the posts (the playbook_generate job) ----

const STAGE_GUIDE: Record<FunnelStage, string> = {
    TOFU: "TOFU (awareness): reach new people with a useful idea, story or opinion; invite them to get the free lead magnet",
    MOFU: "MOFU (nurture): build trust by teaching and showing proof; point to the lead magnet",
    BOFU: "BOFU (convert): present the offer, answer objections, and ask for the purchase or booking",
    POST: "POST (customers): results, testimonials and tips for people who already bought",
};

const clamp = (text: string, max: number) => [...text].slice(0, max).join("");

const draftSchema = z.object({
    facebook: z.string().min(1),
    instagram: z.string().min(1),
    linkedin: z.string().min(1),
    visualBrief: z.string().min(1),
});
type Draft = z.infer<typeof draftSchema>;

type RunContext = {
    teamId: string;
    inputs: RunInputs;
    product: { name: string; description: string | null; priceAmount: number; currency: string } | null;
    icp: { name: string; description: string | null } | null;
    keyword?: string | null; // set when the plan gets a comment keyword auto-reply
};

const audienceText = (ctx: RunContext) =>
    ctx.icp ? `${clamp(ctx.icp.name, 120)}${ctx.icp.description ? `: ${clamp(ctx.icp.description, 500)}` : ""}` : "";

function offerText(ctx: RunContext) {
    if (ctx.product) {
        const price = `${(ctx.product.priceAmount / 100).toFixed(2)} ${ctx.product.currency}`;
        return `${clamp(ctx.product.name, 120)} (${price})${ctx.product.description ? `: ${clamp(ctx.product.description, 500)}` : ""}`;
    }
    return ctx.inputs.offer.type === "booking" ? `A call people book with the creator: ${clamp(ctx.inputs.offer.description, 500)}` : "";
}

// Each post is one AI call, kept short: every provider call has a 30s limit and the Anthropic
// path of askAI caps a reply at 800 tokens (aiService.ts). ROUTINE is enough for short copy and is
// the cheap tier: on DeepSeek it asks for "deepseek-chat", which DeepSeek serves with
// DeepSeek-V4.1-Flash in non-thinking mode (no billed reasoning tokens). Checked 2026-10-02 at
// https://api-docs.deepseek.com/quick_start/pricing and against GET https://api.deepseek.com/models.
const ANGLES = [
    "a common mistake and how to avoid it",
    "a quick, practical tip",
    "a short personal story",
    "a myth to bust",
    "a simple step-by-step",
    "a question that invites replies",
    "a before-and-after",
    "a behind-the-scenes look",
    "a short checklist",
    "a clear opinion",
];
const PARALLEL_CALLS = 4;

export function buildPostPrompt(ctx: RunContext, index: number, total: number, slot: Pick<Slot, "week" | "stage">) {
    const callToAction = ctx.keyword && (slot.stage === "TOFU" || slot.stage === "MOFU")
        ? [`Call to action: ask readers to comment "${ctx.keyword}" to get the free lead magnet.`]
        : [];
    return [
        "You write one social media post for a creator's 4-week launch plan.",
        `Offer: ${offerText(ctx)}`,
        `Audience: ${audienceText(ctx)}`,
        `Free lead magnet they give away: ${clamp(ctx.inputs.leadMagnet, 500)}`,
        `Tone: ${clamp(ctx.inputs.tone, 100)}`,
        "",
        `This is post ${index + 1} of ${total} (week ${slot.week + 1} of ${WEEKS}).`,
        `Funnel stage: ${STAGE_GUIDE[slot.stage]}.`,
        `Angle: ${ANGLES[index % ANGLES.length]}.`,
        ...callToAction,
        "",
        "Write the same idea three ways, plus a visual:",
        "- facebook: at most 500 characters.",
        "- instagram: at most 600 characters including at most 8 hashtags.",
        "- linkedin: at most 600 characters, professional, at most 3 hashtags.",
        "- visualBrief: one sentence describing a suggested image or short video.",
        "Don't include links or URLs; the creator adds them. Don't invent prices, numbers or testimonials that aren't given above.",
        'Return JSON only: {"facebook":"...","instagram":"...","linkedin":"...","visualBrief":"..."}',
    ].join("\n");
}

type Writer = { askAI: (typeof import("@/lib/aiService"))["aiService"]["askAI"]; extractJson: (raw: string) => string };

// Every AI call of a plan (posts and emails) is short copy on the cheap tier.
const AI_OPTIONS = {
    taskType: "CONTENT_PLAYBOOK",
    surface: "GENERIC",
    complexity: TaskComplexity.ROUTINE,
    expectsJson: true,
    disableGuardrails: true,
} as const;

async function writePost(ai: Writer, ctx: RunContext, index: number, total: number, slot: Slot): Promise<Draft> {
    const raw = await ai.askAI(buildPostPrompt(ctx, index, total, slot), ctx.teamId, AI_OPTIONS);
    const p = draftSchema.parse(JSON.parse(ai.extractJson(raw)));
    return {
        facebook: clamp(p.facebook.trim(), 3000),
        instagram: clamp(p.instagram.trim(), INSTAGRAM_LIMITS.caption),
        linkedin: clamp(p.linkedin.trim(), 3000),
        visualBrief: clamp(p.visualBrief.trim(), 1000),
    };
}

/** Runs the calls PARALLEL_CALLS at a time; the first failure stops new calls and is thrown. */
async function writeAll(ai: Writer, ctx: RunContext, slots: Slot[]): Promise<Draft[]> {
    const drafts: Draft[] = new Array(slots.length);
    let next = 0;
    let failed = false;
    const worker = async () => {
        while (!failed && next < slots.length) {
            const i = next++;
            try {
                drafts[i] = await writePost(ai, ctx, i, slots.length, slots[i]!);
            } catch (error) {
                failed = true;
                throw error;
            }
        }
    };
    await Promise.all(Array.from({ length: Math.min(PARALLEL_CALLS, slots.length) }, worker));
    return drafts;
}

/** The two landing pages: the lead magnet's opt-in page, and the offer's page whose buttons open the booking or checkout link. */
export function pageSpecs(ctx: RunContext, run: { productId: string | null; bookingUrl: string | null }, webBaseUrl: string) {
    const offer = offerText(ctx);
    const leadMagnet = clamp(ctx.inputs.leadMagnet, 500);
    const common = [`Audience: ${audienceText(ctx)}`, `Tone: ${clamp(ctx.inputs.tone, 100)}`];
    const booking = ctx.inputs.offer.type === "booking";
    return [
        {
            kind: "leadMagnet" as const,
            name: clamp(ctx.inputs.leadMagnet, 60),
            prompt: [
                `Opt-in page for a free lead magnet: ${leadMagnet}.`,
                ...common,
                "The page's only goal: visitors enter their email to get the free resource. Every call to action is about getting it.",
                `What the creator sells later (don't sell it on this page): ${offer}`,
            ].join("\n"),
            ctaHref: null,
        },
        {
            kind: "sales" as const,
            name: clamp(ctx.product?.name || (ctx.inputs.offer.type === "booking" ? ctx.inputs.offer.description : ctx.inputs.name), 60),
            prompt: [
                `Sales page for: ${offer}`,
                ...common,
                booking ? "Every call to action is booking the call." : "Every call to action is buying it.",
                `Visitors have usually already got the free ${leadMagnet}.`,
            ].join("\n"),
            ctaHref: run.bookingUrl ?? (run.productId ? `${webBaseUrl}/checkout/${encodeURIComponent(run.productId)}` : null),
        },
    ];
}

/**
 * The playbook_generate job. Writes every post first and drafts the landing pages (each id is
 * saved on the run as soon as it exists, so a retry carries on), then saves the posts in one
 * transaction that also moves the run GENERATING -> READY, so a repeated job saves nothing twice.
 * The keyword auto-reply is saved last, through its own checks. Never throws: each AI call is
 * billed, so a failure is recorded on the run for a manual retry instead of the job queue
 * retrying it.
 */
export async function generatePlaybookRun(runId: string, now = new Date()) {
    const run = await prisma.playbookRun.findFirst({
        where: { id: runId, status: "GENERATING" },
        include: {
            product: { select: { name: true, description: true, priceAmount: true, currency: true } },
            icp: { select: { name: true, description: true } },
        },
    });
    if (!run) return { done: false };
    try {
        const inputs = run.inputs as unknown as RunInputs;
        const slots = planSlots(inputs, await getStageMix(run.teamId), now);
        const account = await triggerAccount(run.teamId, inputs.accountIds ?? []);
        const keyword = inputs.keyword || DEFAULT_KEYWORD;
        const ctx: RunContext = { teamId: run.teamId, inputs, product: run.product, icp: run.icp, keyword: account ? keyword : null };
        const [{ aiService }, { extractJsonCandidate }, { WEB_BASE_URL }] = await Promise.all([
            import("@/lib/aiService"),
            import("@/modules/landing-agent/service"),
            import("./keywordTriggers"),
        ]);
        const ai: Writer = { askAI: (...args) => aiService.askAI(...args), extractJson: extractJsonCandidate };
        const bundle: BundleRun & SequenceRun = { ...run };
        // The sequences link to the sales page, so they're written once the pages exist.
        const pagesThenSequences = async () => {
            const ids = await Promise.all(pageSpecs(ctx, run, WEB_BASE_URL).map((spec) => ensurePage(bundle, spec)));
            const sales = await prisma.landingPage.findFirst({ where: { id: ids[1]!, teamId: run.teamId }, select: { slug: true } });
            const specs = sequenceSpecs({
                leadMagnet: clamp(inputs.leadMagnet, 500),
                booking: inputs.offer.type === "booking",
                bookingUrl: run.bookingUrl,
                salesPageUrl: sales?.slug ? `${WEB_BASE_URL}/p/${encodeURIComponent(sales.slug)}` : null,
                checkoutUrl: run.productId ? `${WEB_BASE_URL}/checkout/${encodeURIComponent(run.productId)}` : null,
            });
            const email = {
                write: (prompt: string) => ai.askAI(prompt, run.teamId, AI_OPTIONS),
                extractJson: ai.extractJson,
                context: [`Offer: ${offerText(ctx)}`, `Audience: ${audienceText(ctx)}`, `Free lead magnet: ${clamp(inputs.leadMagnet, 500)}`, `Tone: ${clamp(inputs.tone, 100)}`],
                timezone: inputs.timezone,
            };
            await Promise.all(specs.map((spec) => ensureSequence(bundle, spec, email)));
            return ids;
        };
        const [drafts, pageIds] = await Promise.all([writeAll(ai, ctx, slots), pagesThenSequences()]);
        const notes = account ? null : "No Instagram account or Facebook Page was picked, so there's no comment keyword auto-reply. You can add one in Settings > Social accounts.";

        const saved = await prisma.$transaction(async (tx) => {
            const claimed = await tx.playbookRun.updateMany({ where: { id: run.id, status: "GENERATING" }, data: { status: "READY", error: null, notes } });
            if (claimed.count !== 1) return false; // deleted, or another attempt already saved
            const accounts = await tx.socialAccount.findMany({
                where: { teamId: run.teamId, id: { in: inputs.accountIds ?? [] }, status: { not: "DISCONNECTED" } },
                select: { id: true },
            });
            const posts = slots.map((slot, i) => ({
                id: crypto.randomUUID(),
                teamId: run.teamId,
                createdById: run.createdById,
                playbookRunId: run.id,
                funnelStage: slot.stage,
                scheduledAt: slot.scheduledAt,
                timezone: inputs.timezone,
                body: drafts[i]!.facebook,
                channelCaptions: { INSTAGRAM: drafts[i]!.instagram, LINKEDIN: drafts[i]!.linkedin },
                visualBrief: drafts[i]!.visualBrief,
            }));
            await tx.contentPost.createMany({ data: posts });
            if (accounts.length) {
                await tx.contentPostTarget.createMany({ data: posts.flatMap((p) => accounts.map((a) => ({ postId: p.id, socialAccountId: a.id }))) });
            }
            return true;
        }, { timeout: 20_000 });
        if (saved && account) {
            const note = await createPlanTrigger(bundle, { socialAccountId: account.id, keyword, leadMagnet: inputs.leadMagnet, landingPageId: pageIds[0]! });
            if (note) await prisma.playbookRun.updateMany({ where: { id: run.id }, data: { notes: note } });
        }
        return { done: saved };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[PlaybookWizard] Run ${run.id} failed:`, message);
        await prisma.playbookRun.updateMany({
            where: { id: run.id, status: "GENERATING" },
            data: {
                status: "FAILED",
                error: message.includes("Insufficient credits")
                    ? "Not enough AI credits to write the posts. Add credits, then try again."
                    : "Couldn't write the plan this time. Try again.",
            },
        });
        return { done: false };
    }
}

// ---- Review and delete ----

const RUN_SELECT = {
    id: true, name: true, status: true, error: true, notes: true, inputs: true, bookingUrl: true, icpCreated: true, createdAt: true, updatedAt: true,
    product: { select: { id: true, name: true } },
    icp: { select: { id: true, name: true } },
} satisfies Prisma.PlaybookRunSelect;

function withStale<T extends { status: string; updatedAt: Date }>(run: T, now: Date) {
    return { ...run, stale: isStale(run, now) };
}

export async function listRuns(teamId: string, now = new Date()) {
    const runs = await prisma.playbookRun.findMany({
        where: { teamId },
        select: { ...RUN_SELECT, _count: { select: { contentPosts: true } } },
        orderBy: { createdAt: "desc" },
        take: 50,
    });
    return runs.map((run) => withStale(run, now));
}

export async function getRun(teamId: string, runId: string, now = new Date()) {
    const run = await prisma.playbookRun.findFirst({
        where: { id: runId, teamId },
        select: {
            ...RUN_SELECT,
            contentPosts: {
                select: {
                    id: true, body: true, channelCaptions: true, visualBrief: true, funnelStage: true, status: true, scheduledAt: true,
                    targets: { select: { status: true, socialAccount: { select: { id: true, platform: true, handle: true } } } },
                },
                orderBy: [{ scheduledAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
            },
        },
    });
    if (!run) throw new ContentPostError(404, "Plan not found");
    const ids = await prisma.playbookRun.findFirst({
        where: { id: runId, teamId },
        select: {
            leadMagnetCampaignId: true, salesCampaignId: true, leadMagnetPageId: true, salesPageId: true, keywordTriggerId: true,
            nurtureCampaignId: true, cartAbandonCampaignId: true, postPurchaseCampaignId: true,
        },
    });
    const pageIds = [ids?.leadMagnetPageId, ids?.salesPageId].filter((id): id is string => Boolean(id));
    const [pages, trigger, sequences] = await Promise.all([
        pageIds.length
            ? prisma.landingPage.findMany({ where: { id: { in: pageIds }, teamId }, select: { id: true, campaignId: true, slug: true, title: true, status: true } })
            : [],
        ids?.keywordTriggerId
            ? prisma.keywordTrigger.findFirst({
                  where: { id: ids.keywordTriggerId, teamId },
                  select: { id: true, keywords: true, active: true, socialAccount: { select: { platform: true, handle: true } } },
              })
            : null,
        planSequences(teamId, [ids?.nurtureCampaignId ?? null, ids?.cartAbandonCampaignId ?? null, ids?.postPurchaseCampaignId ?? null]),
    ]);
    const page = (id: string | null | undefined) => pages.find((p) => p.id === id) ?? null;
    return { ...withStale(run, now), leadMagnetPage: page(ids?.leadMagnetPageId), salesPage: page(ids?.salesPageId), keywordTrigger: trigger, sequences };
}

/**
 * Deletes a run and every draft it made. A post that's already live (even on one account) is
 * kept, just no longer linked to the run; approvals of deleted posts are withdrawn. The same goes
 * for its landing pages (a published one stays) and its keyword auto-reply (one switched on
 * stays), and its email sequences (one anyone joined, or a switched-on product sends, stays).
 * An audience the wizard created stays in the ICP builder, since other campaigns may use it by now.
 */
export async function deleteRun(teamId: string, runId: string) {
    const run = await prisma.playbookRun.findFirst({
        where: { id: runId, teamId },
        select: {
            id: true, teamId: true, createdById: true, icpId: true, keywordTriggerId: true,
            leadMagnetCampaignId: true, leadMagnetPageId: true, salesCampaignId: true, salesPageId: true,
            nurtureCampaignId: true, cartAbandonCampaignId: true, postPurchaseCampaignId: true,
        },
    });
    if (!run) throw new ContentPostError(404, "Plan not found");
    const posts = await prisma.contentPost.findMany({ where: { teamId, playbookRunId: run.id }, select: { id: true } });
    let deleted = 0;
    let kept = 0;
    for (const post of posts) {
        try {
            await deletePost(teamId, post.id);
            deleted++;
        } catch (error) {
            if (!(error instanceof ContentPostError)) throw error;
            kept++;
        }
    }
    const bundle = await deleteBundle(run);
    const sequences = await deleteSequences(run);
    await prisma.playbookRun.deleteMany({ where: { id: run.id, teamId } });
    return { deleted, kept, ...bundle, ...sequences };
}
