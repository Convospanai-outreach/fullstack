import { describe, expect, it } from "vitest";
import { intentBreakdownLines, intentTier } from "./intentBreakdown";

describe("intentTier", () => {
    it("uses 40% and 70% thresholds", () => {
        expect(intentTier(null)).toBe("COLD");
        expect(intentTier(0.4)).toBe("WARM");
        expect(intentTier(0.7)).toBe("HOT");
    });
});

describe("intentBreakdownLines", () => {
    it("weights each input and caps it at its maximum", () => {
        expect(intentBreakdownLines({ dwellTimeMinutes: 10, emailClicks: 40, socialMentions: 0 })).toEqual([
            "Dwell time: 10 min (+20 of 40 points)",
            "Click-through: 40 clicks (+35 of 35 points)",
            "Social: 0 mentions (+0 of 25 points)",
        ]);
    });
    it("treats missing values as zero", () => {
        expect(intentBreakdownLines({})[0]).toBe("Dwell time: 0 min (+0 of 40 points)");
    });
});
