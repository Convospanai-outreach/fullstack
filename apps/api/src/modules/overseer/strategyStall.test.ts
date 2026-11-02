import { describe, it, expect } from "vitest";
import { stallRuleFor, strategyIdsFromConfig } from "./strategyStall";

describe("stallRuleFor", () => {
    it("keeps the usual threshold with no strategies or unknown config", () => {
        expect(stallRuleFor(null, 5)).toEqual({ days: 5, note: null });
        expect(stallRuleFor({ strategies: ["S10"] }, 5)).toEqual({ days: 5, note: null });
        expect(strategyIdsFromConfig({ strategies: "S3" })).toEqual([]);
    });

    it("uses the shortest rhythm among the campaign's strategies", () => {
        const rule = stallRuleFor({ strategies: ["S10", "S1", "S3"] }, 5);
        expect(rule.days).toBe(2);
        expect(rule.note).toContain("expects activity within 2 days");
    });

    it("does not lengthen a threshold that is already shorter", () => {
        expect(stallRuleFor({ strategies: ["S3"] }, 1)).toEqual({ days: 1, note: null });
    });
});
