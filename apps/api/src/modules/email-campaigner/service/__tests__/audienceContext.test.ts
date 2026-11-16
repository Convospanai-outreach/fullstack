import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
    prisma: { lead: { findFirst: vi.fn() }, campaign: { findFirst: vi.fn() } },
}));

import { prisma } from "@/lib/db";
import { buildAudienceContext, loadAudienceContext } from "../audienceContext";
import { buildCritiquePrompt, buildNodeAPrompt, buildNodeBPrompt, buildNodeCPrompt } from "../emailComposer";
import { buildRubricCritiquePrompt } from "../rubricCritic";

const p = prisma as any;

describe("buildAudienceContext", () => {
    it("is undefined with no ICP, location or style, so the prompt is unchanged", () => {
        expect(buildAudienceContext({ icp: null, lead: { location: null, regionId: "GLOBAL" } })).toBeUndefined();
        expect(buildAudienceContext({})).toBeUndefined();
    });

    it("reads the matcher shape (industries, jobTitles, companySize) and the market, skipping GLOBAL", () => {
        const text = buildAudienceContext({
            icp: { name: "Mid-market SaaS", description: "Growth teams", criteria: { industries: ["SaaS", "Fintech"], jobTitles: ["VP Sales"], companySize: { min: 50, max: 500 } } },
            lead: { location: "Dubai, UAE", regionId: "UAE" },
        })!;
        expect(text).toContain("Industries: SaaS, Fintech");
        expect(text).toContain("Typical roles: VP Sales");
        expect(text).toContain("Company size: 50-500 employees");
        expect(text).toContain("Prospect location: Dubai, UAE");
        expect(text).toContain("Prospect market: UAE");
        expect(buildAudienceContext({ lead: { location: null, regionId: "GLOBAL" } })).toBeUndefined();
    });

    it("reads the ICP builder shape (industry, role, size) and the agent shape (buyerTitles, companySizes)", () => {
        const builder = buildAudienceContext({ icp: { name: "X", criteria: { industry: "FinTech", role: "CTO, VP Engineering", size: "51-200", painPoints: "ignored" } } })!;
        expect(builder).toContain("Industries: FinTech");
        expect(builder).toContain("Typical roles: CTO, VP Engineering");
        expect(builder).toContain("Company size: 51-200");
        expect(builder).not.toContain("ignored");

        const agent = buildAudienceContext({ icp: { name: "Y", criteria: { industries: ["Retail"], buyerTitles: ["COO"], companySizes: ["201-500"] } } })!;
        expect(agent).toContain("Typical roles: COO");
        expect(agent).toContain("Company size: 201-500");
    });

    it("uses the ICP's target markets only when the lead has no location of its own", () => {
        const icp = { name: "X", criteria: { geographies: ["India", "UAE"] } };
        const noLocation = buildAudienceContext({ icp, lead: { location: null } })!;
        expect(noLocation).toContain("Target markets: India, UAE");
        expect(noLocation).toContain("Prospect location: not known (campaign targets India, UAE)");

        const withLocation = buildAudienceContext({ icp, lead: { location: "Pune, India" } })!;
        expect(withLocation).toContain("Prospect location: Pune, India");
        expect(withLocation).not.toContain("not known");

        expect(buildAudienceContext({ icp: { criteria: { geographies: "India, UK; Germany" } } })).toContain("Target markets: India, UK, Germany");
    });

    it("adds Crystal's communication style when the lead has it", () => {
        const text = buildAudienceContext({
            lead: { location: "Leeds", enrichedData: { crystalKnows: { guidance: { archetype: "Driver", discType: "D", prompt: "Be brief and direct." } } } },
        })!;
        expect(text).toContain("Communication style: Driver, DISC D. Be brief and direct.");
        expect(buildAudienceContext({ lead: { location: "Leeds", enrichedData: { extensionCapture: {} } } })).not.toContain("Communication style");
    });

    it("tolerates malformed criteria and caps list lengths", () => {
        const text = buildAudienceContext({ icp: { name: "X", criteria: { industries: Array.from({ length: 20 }, (_, i) => `i${i}`), jobTitles: 5, companySize: "big" } } })!;
        expect(text.match(/i\d+/g)).toHaveLength(5);
        expect(text).not.toContain("Typical roles");
        expect(text).not.toContain("Company size");
    });
});

describe("loadAudienceContext", () => {
    beforeEach(() => vi.clearAllMocks());

    it("reads the lead and the campaign ICP inside the caller's team only", async () => {
        p.lead.findFirst.mockResolvedValue({ location: "Pune, India", regionId: "GLOBAL", enrichedData: null, campaign: { icp: null } });
        p.campaign.findFirst.mockResolvedValue({ icp: { name: "SaaS", criteria: { industry: "SaaS" } } });

        const text = await loadAudienceContext("team-a", { leadId: "lead-1", campaignId: "camp-1" });

        expect(p.lead.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "lead-1", teamId: "team-a" } }));
        expect(p.campaign.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "camp-1", teamId: "team-a" } }));
        expect(text).toContain("Industries: SaaS");
        expect(text).toContain("Prospect location: Pune, India");
    });

    it("falls back to the lead's own campaign ICP, and returns undefined for a lead in another team", async () => {
        p.lead.findFirst.mockResolvedValue({ location: null, regionId: "GLOBAL", enrichedData: null, campaign: { icp: { name: "Own", criteria: {} } } });
        expect(await loadAudienceContext("team-a", { leadId: "lead-1" })).toContain("Target audience: Own");

        p.lead.findFirst.mockResolvedValue(null);
        expect(await loadAudienceContext("team-a", { leadId: "lead-of-team-b" })).toBeUndefined();
    });

    it("never throws when the lookup fails", async () => {
        p.lead.findFirst.mockRejectedValue(new Error("db down"));
        expect(await loadAudienceContext("team-a", { leadId: "lead-1" })).toBeUndefined();
    });
});

describe("prompts carry the audience", () => {
    const nodeA = {
        prospect_name: "P", prospect_title: "T", prospect_company: "C", pain_context: "pain", outreach_timing: "t",
        avoid_topics: [], hypothesis: "h", signal_type: "s", extracted_signal: "sig", sender_name: "S", sender_email: "s@x.com",
    };
    const followUp = { prospect_name: "P", prospect_title: "T", prospect_company: "C", original_subject: "o", original_body: "b", hypothesis: "h", pain_context: "p", days_since_send: 3, signal_type: "s" };
    const audience = "Prospect location: Pune, India";

    it("adds the AUDIENCE section with the usage rules to Nodes A, B and C only when there is one", () => {
        for (const prompt of [buildNodeAPrompt({ ...nodeA, audience_context: audience }), buildNodeBPrompt({ ...followUp, audience_context: audience }), buildNodeCPrompt({ ...followUp, audience_context: audience })]) {
            expect(prompt).toContain("## AUDIENCE");
            expect(prompt).toContain(audience);
            expect(prompt).toContain("No stereotypes");
            expect(prompt).toContain("never name or hint at a personality type");
        }
        for (const prompt of [buildNodeAPrompt(nodeA), buildNodeBPrompt(followUp), buildNodeCPrompt(followUp)]) {
            expect(prompt).not.toContain("## AUDIENCE");
        }
    });

    it("makes the standard critic check the audience rule only when an audience was supplied", () => {
        const draft = { subject: "s", body: "b" };
        expect(buildCritiquePrompt({ ...nodeA, audience_context: audience }, draft)).toContain("7. Audience");
        expect(buildCritiquePrompt(nodeA, draft)).not.toContain("7. Audience");
    });

    it("always lists the audience blocker for the rubric critic", () => {
        const prompt = buildRubricCritiquePrompt(nodeA, { subject: "s", body: "b" }, { criteria: [{ id: "c", description: "d", weight: 1 }], passScore: 4 }, "style");
        expect(prompt).toContain("audience: the email mentions the prospect's country");
    });
});
