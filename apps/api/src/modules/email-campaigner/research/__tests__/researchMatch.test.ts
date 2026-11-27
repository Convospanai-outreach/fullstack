import { describe, expect, it } from "vitest";
import { checkDraft, matchAngle, offerItemsFrom } from "../researchMatch";
import type { CompanyResearch } from "../companyResearch";

const now = new Date("2026-11-27T00:00:00Z");
const research = (over: Partial<CompanyResearch> = {}): CompanyResearch => ({
    domain: "acme.com",
    fetchedAt: now.toISOString(),
    sells: "Acme sells warehouse robotics to mid-size logistics firms.",
    buyerQuestion: "How long does warehouse robotics integration take?",
    facts: [
        { kind: "news", title: "Acme opens Pune fulfilment centre", url: "https://acme.com/news/pune", date: "2026-11-20" },
        { kind: "post", title: "Old post about packaging", url: "https://acme.com/blog/old", date: "2025-01-02" },
    ],
    firecrawlCredits: 7,
    ...over,
});
const offers = ["Two week robotics integration playbook for logistics teams", "Bookkeeping templates for freelancers"];

describe("offerItemsFrom", () => {
    it("splits lines and sentences, drops fragments, dedupes", () => {
        const items = offerItemsFrom(["We build funnels for coaches. We build funnels for coaches.\nShort", "A done-for-you onboarding sequence for new clients"]);
        expect(items).toEqual(["We build funnels for coaches.", "A done-for-you onboarding sequence for new clients"]);
    });
});

describe("matchAngle", () => {
    it("pairs the freshest fact, the buyer question and the offer item that answers it", () => {
        const angle = matchAngle(research(), offers, now);
        expect(angle?.fact.title).toContain("Pune");
        expect(angle?.offerItem).toBe(offers[0]);
        expect(angle?.question).toContain("integration");
    });
    it("returns null when no fact is fresh", () => {
        expect(matchAngle(research({ facts: [research().facts[1]!] }), offers, now)).toBeNull();
    });
    it("returns null when there is no buyer question", () => {
        expect(matchAngle(research({ buyerQuestion: "" }), offers, now)).toBeNull();
    });
    it("returns null when no offer item relates to what they sell", () => {
        expect(matchAngle(research(), ["Bookkeeping templates for freelancers"], now)).toBeNull();
    });
    it("returns null with no offer items", () => {
        expect(matchAngle(research(), [], now)).toBeNull();
    });
});

describe("checkDraft", () => {
    const angle = matchAngle(research(), offers, now)!;
    const good = {
        subject: "pune centre",
        body: "Saw Acme opened its Pune fulfilment centre. Teams in that spot often ask how long warehouse robotics integration takes. We run a two week robotics integration playbook for logistics teams. Worth a look?",
    };
    it("passes a draft that uses the fact, the question and the offer", () => {
        expect(checkDraft(good, angle, research(), "")).toEqual([]);
    });
    it("flags a draft that ignores the fresh fact", () => {
        const issues = checkDraft({ subject: "integration", body: "Teams ask how long warehouse robotics integration takes. We run a two week robotics integration playbook for logistics teams." }, angle, research(), "");
        expect(issues.join(" ")).toMatch(/fresh fact/);
    });
    it("flags a draft that never names the offer", () => {
        const issues = checkDraft({ ...good, body: "Saw Acme opened its Pune fulfilment centre. How long does warehouse robotics integration take for you?" }, angle, research(), "");
        expect(issues.join(" ")).toMatch(/offer/);
    });
    it("flags a draft that skips the buyer question topic", () => {
        const issues = checkDraft({ ...good, body: "Saw Acme opened its Pune fulfilment centre. We run a two week robotics integration playbook for logistics teams." }, angle, research(), "");
        expect(issues.join(" ")).toMatch(/question/);
    });
    it("flags a number that no source supports", () => {
        const issues = checkDraft({ ...good, body: `${good.body} Customers cut costs by 43%.` }, angle, research(), "");
        expect(issues.join(" ")).toMatch(/43|number|support/i);
    });
});
