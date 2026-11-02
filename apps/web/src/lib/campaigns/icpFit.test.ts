import { describe, expect, it } from "vitest";
import { icpFit } from "./icpFit";

const specific = { jobTitles: ["VP Sales", "Head of Sales"], industries: ["SaaS"], companySize: { min: 50, max: 500 } };
const formOnly = { role: "VP Sales", industry: "SaaS", size: "50-500", painPoints: "slow ramp" };
const broad = { industries: ["SaaS", "Retail", "Banking", "Health", "Energy"], jobTitles: ["VP Sales", "CEO", "CFO", "CTO", "COO", "CMO"] };

const ids = (items: { strategyId: string }[]) => items.map((i) => i.strategyId);

describe("icpFit notes", () => {
    it("warns that a vague ICP cannot be narrowed by the broad-to-niche funnel", () => {
        const fit = icpFit({}, ["S10"]);
        expect(fit.notes).toHaveLength(1);
        expect(fit.notes[0]).toMatchObject({ strategyId: "S10", level: "warning" });
        expect(ids(icpFit(broad, ["S10"]).notes)).toEqual(["S10"]);
        expect(icpFit(specific, ["S10"]).notes).toEqual([]);
        expect(icpFit(null, ["S10"]).notes).toHaveLength(1);
    });

    it("warns when 4-3-2-1 distribution is given more than one audience, and says how many", () => {
        const fit = icpFit(broad, ["S11"]);
        expect(fit.notes[0]).toMatchObject({ strategyId: "S11", level: "warning" });
        expect(fit.notes[0]!.text).toContain("6 roles and 5 industries");
        expect(icpFit(specific, ["S11"]).notes).toEqual([]);
    });

    it("reminds about the audience source for strategies an ICP cannot judge", () => {
        const fit = icpFit(specific, ["S3", "S1", "S6"]);
        expect(fit.notes.map((n) => n.level)).toEqual(["info", "info", "info"]);
        expect(ids(fit.notes).sort()).toEqual(["S1", "S3", "S6"]);
    });

    it("has no notes without strategies", () => {
        expect(icpFit(specific, [])).toMatchObject({ notes: [] });
    });
});

describe("icpFit suggestions", () => {
    it("suggests the funnel and the distribution plan for a specific, single-audience ICP", () => {
        expect(ids(icpFit(specific, []).suggestions)).toEqual(["S10", "S11"]);
    });

    it("reads the form's single answers when the generated lists are missing", () => {
        expect(ids(icpFit(formOnly, []).suggestions)).toEqual(["S10", "S11"]);
    });

    it("does not suggest what is already chosen", () => {
        expect(ids(icpFit(specific, ["S10"]).suggestions)).toEqual(["S11"]);
        expect(icpFit(specific, ["S10", "S11"]).suggestions).toEqual([]);
    });

    it("suggests nothing for a vague or multi-audience ICP, and never suggests onboarding, daily or habit strategies", () => {
        expect(icpFit({}, []).suggestions).toEqual([]);
        expect(icpFit(broad, []).suggestions).toEqual([]);
        const all = ids(icpFit(specific, []).suggestions);
        for (const id of ["S1", "S3", "S6"]) expect(all).not.toContain(id);
    });

    it("treats a role and an industry without a size or pain point as one audience, but not yet specific", () => {
        const partial = { jobTitles: ["VP Sales"], industries: ["SaaS"] };
        expect(ids(icpFit(partial, []).suggestions)).toEqual(["S11"]);
    });
});
