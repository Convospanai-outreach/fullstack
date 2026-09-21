import { describe, it, expect } from "vitest";
import { getExpiryState, formatTimeLeft, EXPIRY_WARN_WINDOW_MS } from "./approvalExpiry";

const NOW = new Date("2026-09-21T12:00:00.000Z").getTime();
const inMs = (ms: number) => new Date(NOW + ms).toISOString();

describe("getExpiryState", () => {
    it("returns 'none' for a null/undefined or unparseable deadline", () => {
        expect(getExpiryState(null, NOW)).toBe("none");
        expect(getExpiryState(undefined, NOW)).toBe("none");
        expect(getExpiryState("not-a-date", NOW)).toBe("none");
    });

    it("returns 'expired' once the deadline has passed", () => {
        expect(getExpiryState(inMs(-1), NOW)).toBe("expired");
        expect(getExpiryState(inMs(0), NOW)).toBe("expired");
    });

    it("returns 'soon' inside the warning window (boundary inclusive)", () => {
        expect(getExpiryState(inMs(60 * 1000), NOW)).toBe("soon");
        expect(getExpiryState(inMs(EXPIRY_WARN_WINDOW_MS), NOW)).toBe("soon");
    });

    it("returns 'later' beyond the warning window", () => {
        expect(getExpiryState(inMs(EXPIRY_WARN_WINDOW_MS + 1), NOW)).toBe("later");
        expect(getExpiryState(inMs(24 * 60 * 60 * 1000), NOW)).toBe("later");
    });
});

describe("formatTimeLeft", () => {
    it("uses minutes under an hour (never rounding to 0)", () => {
        expect(formatTimeLeft(inMs(30 * 60 * 1000), NOW)).toBe("30m");
        expect(formatTimeLeft(inMs(10 * 1000), NOW)).toBe("1m");
    });

    it("uses hours under a day and days beyond", () => {
        expect(formatTimeLeft(inMs(3 * 60 * 60 * 1000), NOW)).toBe("3h");
        expect(formatTimeLeft(inMs(2 * 24 * 60 * 60 * 1000), NOW)).toBe("2d");
    });
});
