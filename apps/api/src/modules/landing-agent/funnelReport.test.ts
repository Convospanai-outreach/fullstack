import { describe, expect, it } from "vitest";
import { FUNNEL_MAX_RANGE_DAYS, buildFunnelSteps, parseFunnelRange } from "./funnelReport";

const NOW = new Date("2026-11-01T12:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

describe("buildFunnelSteps", () => {
    it("drop-off from each step to the next: 100 -> 40 -> 20 -> 10 is 60%, 50%, 50%", () => {
        const steps = buildFunnelSteps([
            { key: "visit", label: "Visit", count: 100 },
            { key: "form_start", label: "Form start", count: 40 },
            { key: "lead", label: "Lead", count: 20 },
            { key: "won", label: "Won", count: 10 },
        ]);
        expect(steps.map((s) => s.count)).toEqual([100, 40, 20, 10]);
        expect(steps.map((s) => s.dropOffPercent)).toEqual([null, 60, 50, 50]);
    });

    it("gives null drop-off when the previous step is zero (no NaN or Infinity)", () => {
        const steps = buildFunnelSteps([
            { key: "visit", label: "Visit", count: 0 },
            { key: "form_start", label: "Form start", count: 0 },
            { key: "lead", label: "Lead", count: 3 },
        ]);
        expect(steps.map((s) => s.dropOffPercent)).toEqual([null, null, null]);
    });

    it("keeps raw counts when a later step is larger than the one before (no clamping)", () => {
        const steps = buildFunnelSteps([
            { key: "lead", label: "Lead", count: 10 },
            { key: "won", label: "Won", count: 12 },
        ]);
        expect(steps[1]).toMatchObject({ count: 12, dropOffPercent: -20 });
    });

    it("rounds drop-off to one decimal place: 1 of 3 kept is 66.7% dropped", () => {
        const steps = buildFunnelSteps([
            { key: "a", label: "A", count: 3 },
            { key: "b", label: "B", count: 1 },
        ]);
        expect(steps[1].dropOffPercent).toBe(66.7);
    });
});

describe("parseFunnelRange", () => {
    it("defaults to the last 30 days when no dates are given", () => {
        const range = parseFunnelRange({}, NOW);
        expect(range).toEqual({ ok: true, from: new Date(NOW.getTime() - 30 * DAY_MS), to: NOW });
    });

    it("accepts an explicit range of up to 90 days", () => {
        const from = new Date(NOW.getTime() - FUNNEL_MAX_RANGE_DAYS * DAY_MS);
        const range = parseFunnelRange({ from: from.toISOString(), to: NOW.toISOString() }, NOW);
        expect(range).toEqual({ ok: true, from, to: NOW });
    });

    it("rejects a range longer than 90 days", () => {
        const from = new Date(NOW.getTime() - (FUNNEL_MAX_RANGE_DAYS + 1) * DAY_MS);
        expect(parseFunnelRange({ from: from.toISOString(), to: NOW.toISOString() }, NOW)).toEqual({ ok: false, reason: "range_too_long" });
    });

    it("rejects an end that is not after the start", () => {
        const at = NOW.toISOString();
        expect(parseFunnelRange({ from: at, to: at }, NOW)).toEqual({ ok: false, reason: "invalid_range" });
    });

    it("rejects an unparseable date", () => {
        expect(parseFunnelRange({ from: "not-a-date" }, NOW)).toEqual({ ok: false, reason: "invalid_range" });
    });

    it("rejects an end date in the future", () => {
        const future = new Date(NOW.getTime() + DAY_MS).toISOString();
        expect(parseFunnelRange({ from: "2026-10-01T00:00:00.000Z", to: future }, NOW)).toEqual({ ok: false, reason: "invalid_range" });
    });
});
