import { describe, expect, it } from "vitest";
import { dropOffText, durationText, presetRange } from "./landingFunnelCopy";

describe("durationText", () => {
    it("shows a dash when there is no median", () => {
        expect(durationText(null)).toBe("-");
    });

    it("shows seconds, minutes, hours and days at the largest sensible unit", () => {
        expect(durationText(45)).toBe("45 sec");
        expect(durationText(120)).toBe("2 min");
        expect(durationText(7200)).toBe("2 h");
        expect(durationText(5400)).toBe("1.5 h");
        expect(durationText(86400)).toBe("1 day");
        expect(durationText(259200)).toBe("3 days");
    });
});

describe("dropOffText", () => {
    it("shows a dash for the first step and when the previous step is zero", () => {
        expect(dropOffText(null)).toBe("-");
    });

    it("shows the percentage that did not reach the step", () => {
        expect(dropOffText(60)).toBe("60% drop-off");
        expect(dropOffText(66.7)).toBe("66.7% drop-off");
    });

    it("shows a negative drop-off as a gain, not a minus sign", () => {
        expect(dropOffText(-20)).toBe("20% more than the step before");
    });
});

describe("presetRange", () => {
    const now = new Date("2026-11-01T12:00:00.000Z");

    it("returns the last N days ending now, as ISO strings", () => {
        expect(presetRange(7, now)).toEqual({ from: "2026-10-25T12:00:00.000Z", to: "2026-11-01T12:00:00.000Z" });
    });
});
