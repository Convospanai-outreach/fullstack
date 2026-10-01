import { afterAll, describe, expect, it } from "vitest";

// A zone with DST, set before any Date is built so the helpers see it.
const originalTz = process.env['TZ'];
process.env['TZ'] = "America/New_York";
afterAll(() => {
    if (originalTz === undefined) delete process.env['TZ'];
    else process.env['TZ'] = originalTz;
});

import { addDays, dayKey, fromLocalInput, moveToDay, stageMix, toLocalInput, viewRange, visibleDays } from "./contentCalendar";

describe("contentCalendar", () => {
    it("builds a Monday-first month grid of 6 weeks", () => {
        const days = visibleDays("month", new Date(2026, 9, 15)); // October 2026 starts on a Thursday
        expect(days).toHaveLength(42);
        expect(dayKey(days[0])).toBe("2026-09-28");
        expect(days[0].getDay()).toBe(1);
        expect(dayKey(days[41])).toBe("2026-11-08");
    });

    it("covers a week from Monday to the next Monday", () => {
        const { from, to } = viewRange("week", new Date(2026, 10, 4));
        expect(dayKey(from)).toBe("2026-11-02");
        expect(dayKey(to)).toBe("2026-11-09");
    });

    it("steps whole days across the November DST change", () => {
        const days = visibleDays("week", new Date(2026, 10, 2)); // DST ends Sun 1 Nov 2026
        expect(days.every((d) => d.getHours() === 0)).toBe(true);
        expect(dayKey(addDays(new Date(2026, 9, 31), 2))).toBe("2026-11-02");
    });

    it("keeps the clock time when a post is dragged across a DST change", () => {
        const at = new Date(2026, 9, 30, 10, 30); // Fri 30 Oct, 10:30 EDT
        const moved = moveToDay(at, new Date(2026, 10, 3)); // Tue 3 Nov, now EST
        expect(dayKey(moved)).toBe("2026-11-03");
        expect([moved.getHours(), moved.getMinutes()]).toEqual([10, 30]);
        expect(moved.getTime() - at.getTime()).toBe((4 * 24 + 1) * 60 * 60 * 1000);
    });

    it("round-trips datetime-local values", () => {
        const d = new Date(2026, 10, 1, 9, 5);
        expect(toLocalInput(d)).toBe("2026-11-01T09:05");
        expect(fromLocalInput("2026-11-01T09:05")?.getTime()).toBe(d.getTime());
        expect(fromLocalInput("")).toBeNull();
    });

    it("works out the stage mix in whole percentages", () => {
        const posts = [...Array(6).fill({ funnelStage: "TOFU" }), ...Array(3).fill({ funnelStage: "MOFU" }), { funnelStage: "BOFU" }];
        expect(stageMix(posts)).toEqual({ total: 10, pct: { TOFU: 60, MOFU: 30, BOFU: 10, POST: 0 } });
        expect(stageMix([])).toEqual({ total: 0, pct: { TOFU: 0, MOFU: 0, BOFU: 0, POST: 0 } });
    });
});
