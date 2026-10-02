import type { FunnelStage, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ContentPostError } from "./contentPostService";

// The rest of a playbook wizard run's bundle (spec phase 5b): a lead-magnet opt-in page and a
// sales page drafted through the landing agent, and a switched-off comment keyword auto-reply that
// sends the lead-magnet page. Every id is saved on the PlaybookRun as soon as it exists, so a retry
// carries on instead of making a second copy. Pages stay drafts (published through the landing
// agent's own flow) and the trigger stays off until someone switches it on.

export const DEFAULT_KEYWORD = "GUIDE";

type PageKind = "leadMagnet" | "sales";
const PAGE_SLOT: Record<PageKind, { campaign: "leadMagnetCampaignId" | "salesCampaignId"; page: "leadMagnetPageId" | "salesPageId"; stage: FunnelStage }> = {
    leadMagnet: { campaign: "leadMagnetCampaignId", page: "leadMagnetPageId", stage: "TOFU" },
    sales: { campaign: "salesCampaignId", page: "salesPageId", stage: "BOFU" },
};

export type BundleRun = {
    id: string;
    teamId: string;
    createdById: string | null;
    icpId: string | null;
    leadMagnetCampaignId: string | null;
    leadMagnetPageId: string | null;
    salesCampaignId: string | null;
    salesPageId: string | null;
    keywordTriggerId: string | null;
};

export type PageSpec = { kind: PageKind; name: string; prompt: string; ctaHref: string | null };

/** Saves ids on the run while it is still being written; false once it was deleted or finished. */
async function saveIds(runId: string, data: Prisma.PlaybookRunUpdateManyMutationInput) {
    const res = await prisma.playbookRun.updateMany({ where: { id: runId, status: "GENERATING" }, data });
    if (res.count !== 1) throw new Error("run is no longer being written");
}

/** Points every button of a page's sections at href (the sales page's booking or checkout link). */
export function withCtaHref(renderedJson: unknown, href: string): unknown {
    const link = (section: unknown) =>
        section && typeof section === "object" && ((section as Record<string, unknown>)["ctaLabel"] || (section as Record<string, unknown>)["type"] === "cta_form")
            ? { ...(section as Record<string, unknown>), ctaHref: href }
            : section;
    if (Array.isArray(renderedJson)) return renderedJson.map(link);
    if (renderedJson && typeof renderedJson === "object" && Array.isArray((renderedJson as Record<string, unknown>)["sections"])) {
        const data = renderedJson as Record<string, unknown>;
        return { ...data, sections: (data["sections"] as unknown[]).map(link) };
    }
    return renderedJson;
}

/** Drafts one landing page through the landing agent (campaign, brief, wireframes, page), or returns the one already made. */
export async function ensurePage(run: BundleRun, spec: PageSpec): Promise<string> {
    const slot = PAGE_SLOT[spec.kind];
    const existing = run[slot.page];
    if (existing) return existing;
    if (!run.icpId) throw new Error("the plan's audience was deleted");
    if (!run.createdById) throw new Error("the plan has no author");
    const { landingAgentService } = await import("@/modules/landing-agent/service");

    let campaignId = run[slot.campaign];
    if (!campaignId) {
        const campaign = await landingAgentService.createCampaign({
            teamId: run.teamId,
            userId: run.createdById,
            name: spec.name,
            prompt: spec.prompt,
            icpId: run.icpId,
        });
        campaignId = campaign.id;
        await saveIds(run.id, { [slot.campaign]: campaignId });
        run[slot.campaign] = campaignId;
    }
    // Both fall back to a generic draft when the AI call fails, so a page always comes out.
    await landingAgentService.generateBrief({ teamId: run.teamId, campaignId });
    const options = await landingAgentService.generateWireframes({ teamId: run.teamId, campaignId });
    const best = options[0];
    if (!best) throw new Error("no wireframe options");
    const page = await landingAgentService.selectWireframe({ teamId: run.teamId, campaignId, wireframeId: best.id });

    await prisma.landingPage.updateMany({
        where: { id: page.id, teamId: run.teamId },
        data: {
            funnelStage: slot.stage,
            ...(spec.ctaHref ? { renderedJson: withCtaHref(page.renderedJson, spec.ctaHref) as Prisma.InputJsonValue } : {}),
        },
    });
    await saveIds(run.id, { [slot.page]: page.id });
    run[slot.page] = page.id;
    return page.id;
}

/** The plan's account the keyword auto-reply listens on: Instagram first, then a Facebook Page. */
export async function triggerAccount(teamId: string, accountIds: string[]) {
    if (accountIds.length === 0) return null;
    const accounts = await prisma.socialAccount.findMany({
        where: { teamId, id: { in: accountIds }, platform: { in: ["INSTAGRAM", "FACEBOOK_PAGE"] }, status: { not: "DISCONNECTED" } },
        select: { id: true, platform: true },
    });
    return accounts.find((a) => a.platform === "INSTAGRAM") ?? accounts[0] ?? null;
}

/**
 * Saves the switched-off keyword auto-reply that DMs the lead-magnet page to commenters.
 * Returns a note for the plan when it can't (the trigger's own checks, e.g. content rules).
 */
export async function createPlanTrigger(run: BundleRun, input: { socialAccountId: string; keyword: string; leadMagnet: string; landingPageId: string }) {
    if (run.keywordTriggerId || !run.createdById) return null;
    const { createTrigger, createTriggerSchema } = await import("./keywordTriggerService");
    try {
        const trigger = await createTrigger(run.teamId, run.createdById, createTriggerSchema.parse({
            socialAccountId: input.socialAccountId,
            keywords: [input.keyword],
            replyText: `Here's your free ${[...input.leadMagnet].slice(0, 200).join("")}:`,
            landingPageId: input.landingPageId,
        }));
        await prisma.playbookRun.updateMany({ where: { id: run.id, teamId: run.teamId }, data: { keywordTriggerId: trigger.id } });
        return null;
    } catch (error) {
        const reason = error instanceof ContentPostError ? error.message : "something went wrong";
        console.error(`[PlaybookWizard] Run ${run.id}: keyword auto-reply not saved:`, error instanceof Error ? error.message : error);
        return `The comment keyword auto-reply wasn't set up (${reason}). You can add it in Settings > Social accounts.`;
    }
}

/**
 * The bundle part of deleting a plan. Like posts, anything live is kept: a published page (its
 * campaign stays) and a switched-on trigger. Drafts go, with any pending publish approval withdrawn.
 */
export async function deleteBundle(run: BundleRun) {
    let triggerKept = false;
    if (run.keywordTriggerId) {
        const trigger = await prisma.keywordTrigger.findFirst({ where: { id: run.keywordTriggerId, teamId: run.teamId }, select: { active: true } });
        if (trigger?.active) triggerKept = true;
        else if (trigger) await prisma.keywordTrigger.deleteMany({ where: { id: run.keywordTriggerId, teamId: run.teamId, active: false } });
    }
    let pagesDeleted = 0;
    let pagesKept = 0;
    for (const campaignId of [run.leadMagnetCampaignId, run.salesCampaignId]) {
        if (!campaignId) continue;
        const pages = await prisma.landingPage.findMany({ where: { campaignId, teamId: run.teamId }, select: { id: true, status: true } });
        if (pages.some((p) => p.status === "published")) {
            pagesKept++;
            continue;
        }
        if (pages.length) {
            await prisma.approvalRequest.updateMany({
                where: { teamId: run.teamId, entityType: "LandingPage", entityId: { in: pages.map((p) => p.id) }, status: "PENDING" },
                data: { status: "REJECTED", reviewNote: "Withdrawn: the launch plan was deleted", reviewedAt: new Date() },
            });
        }
        // Conditional, so a page published in the meantime is never deleted.
        const res = await prisma.landingCampaign.deleteMany({ where: { id: campaignId, teamId: run.teamId, pages: { none: { status: "published" } } } });
        if (res.count) pagesDeleted++;
        else pagesKept++;
    }
    return { pagesDeleted, pagesKept, triggerKept };
}
