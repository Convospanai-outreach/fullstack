import { describe, expect, it } from "vitest";
import { FUNNEL_MAX_RANGE_DAYS, assembleFunnelReport, buildFunnelSteps, parseFunnelRange } from "./funnelReport";

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

    it("rejects an end date far in the future (a browser clock that is badly wrong)", () => {
        const future = new Date(NOW.getTime() + DAY_MS).toISOString();
        expect(parseFunnelRange({ from: "2026-10-01T00:00:00.000Z", to: future }, NOW)).toEqual({ ok: false, reason: "invalid_range" });
    });

    it("moves a window that ends a few seconds ahead of the server back to now, keeping its 90-day span", () => {
        const skewed = new Date(NOW.getTime() + 5_000);
        const from = new Date(skewed.getTime() - FUNNEL_MAX_RANGE_DAYS * DAY_MS);
        expect(parseFunnelRange({ from: from.toISOString(), to: skewed.toISOString() }, NOW)).toEqual({
            ok: true,
            from: new Date(NOW.getTime() - FUNNEL_MAX_RANGE_DAYS * DAY_MS),
            to: NOW,
        });
    });

    it("moves a default 30-day window that ends a few seconds ahead back to now", () => {
        const skewed = new Date(NOW.getTime() + 5_000);
        expect(parseFunnelRange({ to: skewed.toISOString() }, NOW)).toEqual({ ok: true, from: new Date(NOW.getTime() - 30 * DAY_MS), to: NOW });
    });

    it("rejects an end date more than five minutes ahead of the server", () => {
        const ahead = new Date(NOW.getTime() + 10 * 60 * 1000).toISOString();
        expect(parseFunnelRange({ from: "2026-10-01T00:00:00.000Z", to: ahead }, NOW)).toEqual({ ok: false, reason: "invalid_range" });
    });
});

describe("assembleFunnelReport", () => {
    const row = {
        visits: 100,
        form_starts: 40,
        cta_clicks: 30,
        leads: 20,
        contacted: 15,
        replied: 5,
        meetings: 2,
        won: 1,
        qualified: 8,
        median_visit_to_form: 120,
        median_form_to_lead: 30,
        median_lead_to_contact: 3600,
        median_contact_to_reply: 7200,
        median_reply_to_meeting: 86400,
        median_meeting_to_won: null,
        median_lead_to_qualified: 600,
    };

    it("builds the chain with drop-off and the median seconds from the previous step", () => {
        const report = assembleFunnelReport(row, null);
        expect(report.steps.map((s) => [s.key, s.count, s.dropOffPercent, s.medianSecondsFromPrevious])).toEqual([
            ["visit", 100, null, null],
            ["form_start", 40, 60, 120],
            ["lead", 20, 50, 30],
            ["first_contact", 15, 25, 3600],
            ["reply", 5, 66.7, 7200],
            ["meeting", 2, 60, 86400],
            ["won", 1, 50, null],
        ]);
    });

    it("keeps CTA anchor clicks and qualified leads as side metrics, not chain steps", () => {
        const report = assembleFunnelReport(row, null);
        expect(report.steps.map((s) => s.key)).not.toContain("cta_click");
        expect(report.steps.map((s) => s.key)).not.toContain("qualified");
        expect(report.sideMetrics).toEqual({ ctaClicks: 30, qualified: 8, medianSecondsLeadToQualified: 600 });
    });

    it("passes the Instagram reply count through only when given (team-wide, unfiltered)", () => {
        expect(assembleFunnelReport(row, { repliesSent: 42 }).instagram).toEqual({ repliesSent: 42 });
        expect(assembleFunnelReport(row, null).instagram).toBeNull();
    });
});
