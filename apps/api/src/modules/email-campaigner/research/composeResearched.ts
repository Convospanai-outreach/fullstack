import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import type { NodeAInput, NodeAOutput } from "../service/emailComposer";
import { getCompanyResearch, researchEnabled } from "./companyResearch";
import { checkDraft, matchAngle, offerItemsFrom, renderAngle } from "./researchMatch";

// Builds the first-touch email from company research instead of the generic placeholders, and holds
// the lead for a person when the research does not support a specific email.
//
//   feature off (server flag or campaign switch)      -> null: the caller runs exactly as before
//   research missing, unpaid or failed                -> hold
//   no fresh fact + buyer question + matching offer   -> hold
//   draft fails the checks twice                      -> hold
//
// The checks run after the composer's own critic, so a critic rewrite cannot drop the researched
// facts unnoticed.

export type ResearchedDraft = { draft: NodeAOutput | null; hold?: undefined } | { draft?: undefined; hold: string };

export function campaignResearchOn(aiConfig: unknown): boolean {
    return researchEnabled() && typeof aiConfig === "object" && aiConfig !== null && (aiConfig as Record<string, unknown>)["companyResearch"] === true;
}

// What the sender offers, in the sender's own words: the campaign's description and goal, and the
// problem/approach/promise of the linked landing page (a creator's products live there).
async function loadOfferItems(campaign: { id: string; description?: string | null; aiConfig?: unknown }, teamId: string): Promise<string[]> {
    const ai = (typeof campaign.aiConfig === "object" && campaign.aiConfig !== null ? campaign.aiConfig : {}) as Record<string, unknown>;
    const texts: Array<string | null | undefined> = [campaign.description, ai["goal"] as string, ai["context"] as string];
    try {
        const landing = await prisma.landingCampaign.findFirst({
            where: { linkedCampaignId: campaign.id, teamId },
            orderBy: { updatedAt: "desc" },
            select: { solution: true, benefit: true },
        });
        if (landing) texts.push(landing.solution, landing.benefit);
    } catch (error) {
        logger.warn("[company research] landing lookup unavailable", { error: error instanceof Error ? error.message : String(error) });
    }
    return offerItemsFrom(texts.filter((t): t is string => typeof t === "string"));
}

export async function composeWithResearch(args: {
    campaign: { id: string; description?: string | null; aiConfig?: unknown };
    lead: { id: string; domain: string | null; company: string | null };
    teamId: string;
    input: NodeAInput;
    compose: (input: NodeAInput) => Promise<NodeAOutput | null>;
    now?: Date;
}): Promise<ResearchedDraft | null> {
    if (!campaignResearchOn(args.campaign.aiConfig)) return null;
    const now = args.now ?? new Date();

    const result = await getCompanyResearch({ teamId: args.teamId, leadId: args.lead.id, domain: args.lead.domain, company: args.lead.company }, now);
    if (result.status !== "ok") return { hold: result.reason };
    const { research } = result;

    const angle = matchAngle(research, await loadOfferItems(args.campaign, args.teamId), now);
    if (!angle) {
        return { hold: `No usable research angle for ${research.domain}: it needs a recent news item or post, a buyer question, and an offer from this campaign that answers it.` };
    }

    const brief = [args.input.campaign_brief, renderAngle(angle, research)].filter(Boolean).join("\n\n");
    const base: NodeAInput = {
        ...args.input,
        campaign_brief: brief,
        signal_type: "Company research",
        extracted_signal: `${angle.fact.title} (${angle.fact.date})`,
        pain_context: angle.question,
        hypothesis: angle.offerItem,
    };
    const offerContext = [args.input.pain_context, args.input.hypothesis].join("\n");

    let draft = await args.compose(base);
    if (!draft) return { draft: null };
    let issues = checkDraft(draft, angle, research, offerContext);
    if (issues.length === 0) return { draft };

    // One rewrite with the failures spelled out, then a person.
    const retry: NodeAInput = { ...base, constraints: [base.constraints, `Fix these problems from the last attempt: ${issues.join(" ")}`].filter(Boolean).join("\n") };
    draft = await args.compose(retry);
    if (!draft) return { draft: null };
    issues = checkDraft(draft, angle, research, offerContext);
    return issues.length === 0 ? { draft } : { hold: `The email did not use the research: ${issues.join(" ")}` };
}
