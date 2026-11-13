import { describe, expect, it } from "vitest";
import { buildAudienceContext } from "../audienceContext";
import { buildNodeAPrompt } from "../emailComposer";

describe("buildAudienceContext", () => {
    it("is undefined with no ICP and no location, so the prompt is unchanged", () => {
        expect(buildAudienceContext({ icp: null, lead: { location: null, regionId: "GLOBAL" } })).toBeUndefined();
        expect(buildAudienceContext({})).toBeUndefined();
    });

    it("summarises the ICP and the prospect's location, skipping the GLOBAL region", () => {
        const text = buildAudienceContext({
            icp: { name: "Mid-market SaaS", description: "Growth teams", criteria: { industries: ["SaaS", "Fintech"], jobTitles: ["VP Sales"], companySize: { min: 50, max: 500 } } },
            lead: { location: "Dubai, UAE", regionId: "UAE" },
        })!;
        expect(text).toContain("Target audience: Mid-market SaaS");
        expect(text).toContain("Industries: SaaS, Fintech");
        expect(text).toContain("Typical roles: VP Sales");
        expect(text).toContain("Company size: 50-500 employees");
        expect(text).toContain("Prospect location: Dubai, UAE");
        expect(text).toContain("Prospect market: UAE");
        expect(buildAudienceContext({ lead: { location: null, regionId: "GLOBAL" } })).toBeUndefined();
    });

    it("tolerates malformed criteria and caps list lengths", () => {
        const text = buildAudienceContext({ icp: { name: "X", criteria: { industries: Array.from({ length: 20 }, (_, i) => `i${i}`), jobTitles: "nope", companySize: "big" } } })!;
        expect(text.match(/i\d+/g)).toHaveLength(5);
        expect(text).not.toContain("Typical roles");
        expect(text).not.toContain("Company size");
    });
});

describe("Node A prompt audience section", () => {
    const base = {
        prospect_name: "P", prospect_title: "T", prospect_company: "C", pain_context: "pain", outreach_timing: "t",
        avoid_topics: [], hypothesis: "h", signal_type: "s", extracted_signal: "sig", sender_name: "S", sender_email: "s@x.com",
    };

    it("adds an AUDIENCE section with the no-stereotype rules only when there is an audience", () => {
        const withAudience = buildNodeAPrompt({ ...base, audience_context: "Prospect location: Pune, India" });
        expect(withAudience).toContain("## AUDIENCE");
        expect(withAudience).toContain("Prospect location: Pune, India");
        expect(withAudience).toContain("No stereotypes");
        expect(buildNodeAPrompt(base)).not.toContain("## AUDIENCE");
    });
});
