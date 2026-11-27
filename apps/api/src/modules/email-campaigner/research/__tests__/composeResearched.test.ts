import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { findFirst, getResearch } = vi.hoisted(() => ({ findFirst: vi.fn(), getResearch: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { landingCampaign: { findFirst } } }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));
vi.mock("../companyResearch", async (importOriginal) => ({ ...(await importOriginal<typeof import("../companyResearch")>()), getCompanyResearch: getResearch }));

import { campaignResearchOn, composeWithResearch } from "../composeResearched";

const now = new Date("2026-11-27T00:00:00Z");
const research = {
    domain: "acme.com",
    fetchedAt: now.toISOString(),
    sells: "Acme sells warehouse robotics to mid-size logistics firms.",
    buyerQuestion: "How long does warehouse robotics integration take?",
    facts: [{ kind: "news", title: "Acme opens Pune fulfilment centre", url: "https://acme.com/news/pune", date: "2026-11-20" }],
    firecrawlCredits: 7,
};
const campaign = { id: "c1", description: "Two week robotics integration playbook for logistics teams", aiConfig: { companyResearch: true } };
const lead = { id: "l1", domain: "acme.com", company: "Acme" };
const input: any = { prospect_name: "A", prospect_company: "Acme", pain_context: "p", hypothesis: "h", signal_type: "s", extracted_signal: "e", campaign_brief: "" };
const good = {
    subject: "pune centre",
    body: "Saw Acme opened its Pune fulfilment centre. Teams in that spot often ask how long warehouse robotics integration takes. We run a two week robotics integration playbook for logistics teams. Worth a look?",
};
const bad = { subject: "hello", body: "Hope things are going well. Want to chat about robotics sometime?" };

const saved = { ...process.env };
beforeEach(() => {
    vi.clearAllMocks();
    process.env["COMPANY_RESEARCH"] = "on";
    findFirst.mockResolvedValue(null);
    getResearch.mockResolvedValue({ status: "ok", research, cached: false });
});
afterEach(() => {
    process.env = { ...saved };
});

const run = (compose: any, over: any = {}) => composeWithResearch({ campaign, lead, teamId: "t1", input, compose, now, ...over });

describe("composeWithResearch", () => {
    it("does nothing when the server flag is off", async () => {
        process.env["COMPANY_RESEARCH"] = "off";
        const compose = vi.fn();
        expect(await run(compose)).toBeNull();
        expect(getResearch).not.toHaveBeenCalled();
        expect(compose).not.toHaveBeenCalled();
    });

    it("does nothing when the campaign has not switched it on", async () => {
        const compose = vi.fn();
        expect(await run(compose, { campaign: { ...campaign, aiConfig: {} } })).toBeNull();
        expect(getResearch).not.toHaveBeenCalled();
        expect(campaignResearchOn({ companyResearch: true })).toBe(true);
    });

    it("composes from the researched angle and returns a draft that passes", async () => {
        const compose = vi.fn().mockResolvedValue(good);
        const out = await run(compose);
        expect(out).toEqual({ draft: good });
        const sent = compose.mock.calls[0]![0];
        expect(sent.campaign_brief).toContain("RESEARCHED ANGLE");
        expect(sent.extracted_signal).toContain("Pune");
    });

    it("rewrites once with the failures listed, then accepts a draft that passes", async () => {
        const compose = vi.fn().mockResolvedValueOnce(bad).mockResolvedValueOnce(good);
        expect(await run(compose)).toEqual({ draft: good });
        expect(compose).toHaveBeenCalledTimes(2);
        expect(compose.mock.calls[1]![0].constraints).toContain("Fix these problems");
    });

    it("holds when the second draft still ignores the research", async () => {
        const compose = vi.fn().mockResolvedValue(bad);
        const out = await run(compose);
        expect(out?.hold).toMatch(/did not use the research/);
        expect(compose).toHaveBeenCalledTimes(2);
    });

    it("holds, without composing, when no angle can be built", async () => {
        getResearch.mockResolvedValue({ status: "ok", research: { ...research, facts: [] }, cached: true });
        const compose = vi.fn();
        const out = await run(compose);
        expect(out?.hold).toMatch(/No usable research angle/);
        expect(compose).not.toHaveBeenCalled();
    });

    it("holds with the reason when research is unavailable or unpaid", async () => {
        getResearch.mockResolvedValue({ status: "no_credits", reason: "Not enough credits for company research (1 per new company)." });
        const compose = vi.fn();
        expect(await run(compose)).toEqual({ hold: "Not enough credits for company research (1 per new company)." });
        expect(compose).not.toHaveBeenCalled();
    });

    it("passes a failed compose through so the caller's own failure path runs", async () => {
        expect(await run(vi.fn().mockResolvedValue(null))).toEqual({ draft: null });
    });

    it("builds offer items from the linked landing page too", async () => {
        findFirst.mockResolvedValue({ solution: "Two week robotics integration playbook for logistics teams", benefit: null });
        const compose = vi.fn().mockResolvedValue(good);
        const out = await run(compose, { campaign: { id: "c1", description: null, aiConfig: { companyResearch: true } } });
        expect(out).toEqual({ draft: good });
    });
});
