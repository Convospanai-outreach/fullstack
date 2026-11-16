import { describe, expect, it } from "vitest";
import { DEFAULT_SEND_WINDOW, isInsideSendWindow, nextSendTime, resolveRecipientTimeZone, resolveSendWindow } from "./sendWindow";

const win = { ...DEFAULT_SEND_WINDOW, enabled: true }; // Mon-Fri 08:00-18:00
const at = (iso: string) => new Date(iso);

describe("resolveSendWindow", () => {
    it("is off by default and keeps Mon-Fri 08-18", () => {
        expect(resolveSendWindow(undefined)).toEqual({ enabled: false, days: [1, 2, 3, 4, 5], startHour: 8, endHour: 18, timeZone: "UTC" });
    });
    it("takes valid fields and repairs bad ones one by one", () => {
        expect(resolveSendWindow({ enabled: true, days: [1, 9, "x", 3], startHour: 99, endHour: 20, timeZone: "Nope/Zone" })).toEqual({
            enabled: true, days: [1, 3], startHour: 8, endHour: 20, timeZone: "UTC",
        });
    });
    it("never lets the end come before the start", () => {
        const w = resolveSendWindow({ startHour: 10, endHour: 9 });
        expect(w.endHour).toBeGreaterThan(w.startHour);
    });
});

describe("resolveRecipientTimeZone", () => {
    it("prefers the lead's own zone", () => {
        expect(resolveRecipientTimeZone({ marketContext: { timezone: "Asia/Tokyo" }, location: "India" }, "UTC")).toEqual({ timeZone: "Asia/Tokyo", source: "lead" });
    });
    it("then the location text", () => {
        expect(resolveRecipientTimeZone({ location: "Pune, India", phone: "+44 20 7946 0000" }, "UTC")).toEqual({ timeZone: "Asia/Kolkata", source: "location" });
        expect(resolveRecipientTimeZone({ location: "Dubai" }, "UTC").timeZone).toBe("Asia/Dubai");
    });
    it("then the phone country code, longest code first", () => {
        expect(resolveRecipientTimeZone({ phone: "+971 50 123 4567" }, "UTC")).toEqual({ timeZone: "Asia/Dubai", source: "phone" });
        expect(resolveRecipientTimeZone({ phone: "0091 98765 43210" }, "UTC").timeZone).toBe("Asia/Kolkata");
    });
    it("does not guess from a local-format number or a +1 number", () => {
        expect(resolveRecipientTimeZone({ phone: "98765 43210" }, "Europe/Paris")).toEqual({ timeZone: "Europe/Paris", source: "fallback" });
        expect(resolveRecipientTimeZone({ phone: "+1 415 555 0100" }, "UTC").source).toBe("fallback");
    });
    it("does not match a country name inside another word", () => {
        expect(resolveRecipientTimeZone({ location: "Houston Texas" }, "UTC").timeZone).toBe("America/Chicago");
        expect(resolveRecipientTimeZone({ location: "Business Park" }, "UTC").source).toBe("fallback");
    });
    it("falls back to the team zone, and to UTC when that is invalid", () => {
        expect(resolveRecipientTimeZone(null, "Asia/Kolkata")).toEqual({ timeZone: "Asia/Kolkata", source: "fallback" });
        expect(resolveRecipientTimeZone({}, "bogus").timeZone).toBe("UTC");
    });
});

describe("send window clock", () => {
    it("is inside on a weekday morning in the recipient's zone and outside before it opens", () => {
        // Wed 2026-11-18 03:00Z = 08:30 in Kolkata
        expect(isInsideSendWindow(at("2026-11-18T03:00:00Z"), "Asia/Kolkata", win)).toBe(true);
        // 02:00Z = 07:30 in Kolkata
        expect(isInsideSendWindow(at("2026-11-18T02:00:00Z"), "Asia/Kolkata", win)).toBe(false);
    });
    it("the end hour is exclusive", () => {
        expect(isInsideSendWindow(at("2026-11-18T12:29:00Z"), "Asia/Kolkata", win)).toBe(true); // 17:59
        expect(isInsideSendWindow(at("2026-11-18T12:30:00Z"), "Asia/Kolkata", win)).toBe(false); // 18:00
    });
    it("sends straight away inside the window", () => {
        expect(nextSendTime(at("2026-11-18T05:00:00Z"), "Asia/Kolkata", win, "run1")).toBeNull();
    });

    it("moves a Friday-evening send to Monday morning across the weekend", () => {
        // Fri 2026-11-20 19:00 in Kolkata = 13:30Z
        const next = nextSendTime(at("2026-11-20T13:30:00Z"), "Asia/Kolkata", win, "run1")!;
        // Monday 2026-11-23 08:00 IST = 02:30Z, plus under 90 minutes of jitter
        const start = at("2026-11-23T02:30:00Z").getTime();
        expect(next.getTime()).toBeGreaterThanOrEqual(start);
        expect(next.getTime()).toBeLessThan(start + 90 * 60_000);
    });

    it("moves a send that is early in the recipient's day to that same day", () => {
        // Wed 2026-11-18 02:00Z = 07:30 in Kolkata, before the window opens
        const next = nextSendTime(at("2026-11-18T02:00:00Z"), "Asia/Kolkata", win, "run1")!;
        const start = at("2026-11-18T02:30:00Z").getTime();
        expect(next.getTime()).toBeGreaterThanOrEqual(start);
        expect(next.getTime()).toBeLessThan(start + 90 * 60_000);
    });

    it("the same instant is inside for one recipient and outside for another (timezone boundary)", () => {
        const now = at("2026-11-18T14:00:00Z"); // 19:30 Kolkata, 09:00 New York
        expect(isInsideSendWindow(now, "Asia/Kolkata", win)).toBe(false);
        expect(isInsideSendWindow(now, "America/New_York", win)).toBe(true);
        // The Kolkata recipient waits for Thursday 08:00 IST = 02:30Z.
        const next = nextSendTime(now, "Asia/Kolkata", win, "run1")!;
        expect(next.toISOString().slice(0, 10)).toBe("2026-11-19");
    });

    it("a weekday that is a weekend where the recipient is: Sunday evening in New York is already Monday in Tokyo", () => {
        const now = at("2026-11-22T23:00:00Z"); // Sun 18:00 New York, Mon 08:00 Tokyo
        expect(isInsideSendWindow(now, "America/New_York", win)).toBe(false);
        expect(isInsideSendWindow(now, "Asia/Tokyo", win)).toBe(true);
    });

    it("keeps the local start hour across a daylight-saving change", () => {
        // New York leaves DST on Sun 2026-11-01. Fri 2026-10-30 19:00 EDT -> Monday 2026-11-02 08:00 EST = 13:00Z.
        const next = nextSendTime(at("2026-10-30T23:00:00Z"), "America/New_York", win, "run1")!;
        const start = at("2026-11-02T13:00:00Z").getTime();
        expect(next.getTime()).toBeGreaterThanOrEqual(start);
        expect(next.getTime()).toBeLessThan(start + 90 * 60_000);
    });

    it("a start hour that does not exist on a spring-forward day opens after the gap, not an hour before it", () => {
        // New York springs forward on Sun 2026-03-08: 02:00 never happens, the clock goes 01:59 -> 03:00 EDT (07:00Z).
        const sundays = { ...win, days: [0, 1, 2, 3, 4, 5, 6], startHour: 2, endHour: 10, timeZone: "America/New_York" };
        const next = nextSendTime(at("2026-03-08T05:00:00Z"), "America/New_York", sundays, "run1")!; // 00:00 EST
        expect(next.getTime()).toBeGreaterThanOrEqual(at("2026-03-08T07:00:00Z").getTime());
        expect(next.getTime()).toBeLessThan(at("2026-03-08T07:00:00Z").getTime() + 90 * 60_000);
    });

    it("spreads a batch: different jobs get different times, the same job always gets the same one", () => {
        const now = at("2026-11-20T13:30:00Z");
        const times = new Set(Array.from({ length: 30 }, (_, i) => nextSendTime(now, "Asia/Kolkata", win, `run${i}`)!.getTime()));
        expect(times.size).toBeGreaterThan(10);
        expect(nextSendTime(now, "Asia/Kolkata", win, "same")!.getTime()).toBe(nextSendTime(now, "Asia/Kolkata", win, "same")!.getTime());
    });

    it("keeps jitter inside a short window", () => {
        const short = { ...win, startHour: 9, endHour: 10 };
        for (let i = 0; i < 40; i++) {
            const next = nextSendTime(at("2026-11-18T20:00:00Z"), "UTC", short, `r${i}`)!;
            expect(isInsideSendWindow(next, "UTC", short)).toBe(true);
        }
    });

    it("works for a window on weekend days only", () => {
        const weekend = { ...win, days: [0, 6] };
        const next = nextSendTime(at("2026-11-18T10:00:00Z"), "UTC", weekend, "r")!; // Wednesday
        expect(next.getUTCDay()).toBe(6);
    });
});
