import { describe, expect, it } from "vitest";
import type { DraftFactors } from "@/lib/ai/jev";
import { scoreDraft, scoreStrategiesIn } from "../draftScores";

const NONE: DraftFactors = {
    motivation: 0, valueClarity: 0, incentive: 0, friction: 0, anxiety: 0, relevance: 0,
    urgency: 0, distraction: 0, dreamOutcome: 0, likelihood: 0, timeDelay: 0,
};
const ALL: DraftFactors = {
    motivation: 1, valueClarity: 1, incentive: 1, friction: 1, anxiety: 1, relevance: 1,
    urgency: 1, distraction: 1, dreamOutcome: 1, likelihood: 1, timeDelay: 1,
};

describe("scoreStrategiesIn", () => {
    it("picks only the scoring strategies, in a fixed order", () => {
        expect(scoreStrategiesIn(["S10", "S12", "S7"])).toEqual(["S7", "S12"]);
        expect(scoreStrategiesIn(["S3"])).toEqual([]);
    });
});

describe("S7 conversion probability", () => {
    it("is viable for a motivated, clear, low-friction, calm draft", () => {
        const [s7] = scoreDraft({ ...NONE, motivation: 1, valueClarity: 1, incentive: 1 }, ["S7"]);
        // 4*5 + 2*5 + 2*(5-1) - 2*1 = 36
        expect(s7).toMatchObject({ strategyId: "S7", score: 36, viable: true });
    });

    it("is not viable when the reader has no motivation and the draft is anxious", () => {
        const [s7] = scoreDraft({ ...ALL, motivation: 0, valueClarity: 0, incentive: 0 }, ["S7"]);
        // 4*1 + 2*1 + 2*(1-5) - 2*5 = -12
        expect(s7).toMatchObject({ score: -12, viable: false });
        expect(s7!.notes.length).toBeGreaterThan(0);
    });
});

describe("S8 six-factor diagnostic", () => {
    it("adds the positive factors and subtracts anxiety and distraction", () => {
        const [best] = scoreDraft({ ...NONE, incentive: 1, relevance: 1, valueClarity: 1, urgency: 1 }, ["S8"]);
        // 10*1.5 + 10 + 10 + 10 - 1*1.2 - 1*1.2 = 42.6
        expect(best).toMatchObject({ strategyId: "S8", score: 42.6, notes: [] });
    });

    it("recommends fixes for low clarity, distraction and anxiety", () => {
        const [s8] = scoreDraft({ ...NONE, anxiety: 1, distraction: 1 }, ["S8"]);
        expect(s8!.notes.map((n) => n.split(":")[0])).toEqual(["Clarity", "Distraction", "Anxiety"]);
    });
});

describe("S12 value equation", () => {
    it("divides outcome times likelihood by delay times effort, with the draft's friction as effort", () => {
        const [s12] = scoreDraft({ ...NONE, dreamOutcome: 1, likelihood: 1 }, ["S12"]);
        // (10*10) / max(1, 1*1) = 100
        expect(s12).toMatchObject({ strategyId: "S12", score: 100, notes: [] });
    });

    it("diagnoses slow payoff, high effort and weak proof", () => {
        const [s12] = scoreDraft({ ...NONE, timeDelay: 1, friction: 1 }, ["S12"]);
        expect(s12!.notes).toHaveLength(3);
    });
});

describe("scoreDraft", () => {
    it("returns one result per requested strategy", () => {
        expect(scoreDraft(NONE, ["S7", "S8", "S12"]).map((s) => s.strategyId)).toEqual(["S7", "S8", "S12"]);
    });
});
