import { describe, expect, it } from "vitest";
import { experimentReadiness, twoProportionZTest, verdictFor } from "./landingExperimentStats";

// Worked examples were computed by hand and cross-checked with an independent series-based erf.

describe("twoProportionZTest", () => {
    it("100 of 1000 vs 130 of 1000: pooled 0.115, z about 2.1027, confidence about 96.45%", () => {
        const r = twoProportionZTest({ visitorsA: 1000, conversionsA: 100, visitorsB: 1000, conversionsB: 130 });
        expect(r.rateA).toBeCloseTo(0.1, 10);
        expect(r.rateB).toBeCloseTo(0.13, 10);
        expect(r.pooledRate).toBeCloseTo(0.115, 10);
        expect(r.difference).toBeCloseTo(0.03, 10);
        expect(r.z).toBeCloseTo(2.10274, 4);
        expect(r.confidence).toBeCloseTo(96.4512, 3);
    });

    it("50 of 1000 vs 52 of 1000 is far from significant: z about 0.2033, confidence about 16.11%", () => {
        const r = twoProportionZTest({ visitorsA: 1000, conversionsA: 50, visitorsB: 1000, conversionsB: 52 });
        expect(r.z).toBeCloseTo(0.20328, 4);
        expect(r.confidence).toBeCloseTo(16.1085, 2);
    });

    it("identical rates give z 0 and confidence 0", () => {
        const r = twoProportionZTest({ visitorsA: 1000, conversionsA: 100, visitorsB: 1000, conversionsB: 100 });
        expect(r.z).toBe(0);
        expect(r.confidence).toBe(0);
    });

    it("a variant with no visitors gives zero confidence instead of NaN", () => {
        const r = twoProportionZTest({ visitorsA: 0, conversionsA: 0, visitorsB: 1000, conversionsB: 100 });
        expect(r.confidence).toBe(0);
        expect(Number.isNaN(r.z)).toBe(false);
    });
});

describe("experimentReadiness", () => {
    const start = new Date("2026-11-01T00:00:00Z");
    const threeDays = new Date("2026-11-04T00:00:00Z");

    it("needs 100 visitors on each variant", () => {
        const r = experimentReadiness({ visitorsA: 99, visitorsB: 500, startedAt: start, now: threeDays });
        expect(r.ready).toBe(false);
        expect(r.reason).toBe("not_enough_visitors");
    });

    it("needs both variants at 100 or more visitors", () => {
        expect(experimentReadiness({ visitorsA: 100, visitorsB: 100, startedAt: start, now: threeDays }).ready).toBe(true);
        expect(experimentReadiness({ visitorsA: 500, visitorsB: 99, startedAt: start, now: threeDays }).ready).toBe(false);
    });

    it("needs the test to have run 3 full days", () => {
        const r = experimentReadiness({ visitorsA: 500, visitorsB: 500, startedAt: start, now: new Date("2026-11-03T23:59:59Z") });
        expect(r.ready).toBe(false);
        expect(r.reason).toBe("not_enough_days");
    });

    it("is ready at exactly 3 days with 100 visitors each", () => {
        expect(experimentReadiness({ visitorsA: 100, visitorsB: 100, startedAt: start, now: threeDays }).ready).toBe(true);
    });
});

describe("verdictFor", () => {
    const readyStart = new Date("2026-11-01T00:00:00Z");
    const now = new Date("2026-11-10T00:00:00Z");

    it("never names a winner before the readiness thresholds", () => {
        const v = verdictFor({ visitorsA: 50, conversionsA: 5, visitorsB: 1000, conversionsB: 400, startedAt: readyStart, now });
        expect(v.status).toBe("not_enough_data");
        expect(v.winner).toBeNull();
    });

    it("names B as winner when ready and confidence is 95% or more", () => {
        const v = verdictFor({ visitorsA: 1000, conversionsA: 100, visitorsB: 1000, conversionsB: 130, startedAt: readyStart, now });
        expect(v.status).toBe("clear_winner");
        expect(v.winner).toBe("B");
    });

    it("names no winner below 95% confidence even when ready", () => {
        const v = verdictFor({ visitorsA: 1000, conversionsA: 50, visitorsB: 1000, conversionsB: 52, startedAt: readyStart, now });
        expect(v.status).toBe("no_clear_difference");
        expect(v.winner).toBeNull();
    });
});
