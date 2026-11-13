import { describe, expect, it } from "vitest";
import { formatHeartbeatAge } from "./edgeHeartbeat";

const NOW = Date.parse("2026-11-13T12:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe("formatHeartbeatAge", () => {
    it("handles missing or invalid timestamps", () => {
        expect(formatHeartbeatAge(null, NOW)).toBe("never");
        expect(formatHeartbeatAge("nope", NOW)).toBe("never");
    });
    it("formats minutes, hours and days", () => {
        expect(formatHeartbeatAge(ago(20_000), NOW)).toBe("just now");
        expect(formatHeartbeatAge(ago(2 * 60_000), NOW)).toBe("2m ago");
        expect(formatHeartbeatAge(ago(3 * 3_600_000), NOW)).toBe("3h ago");
        expect(formatHeartbeatAge(ago(50 * 3_600_000), NOW)).toBe("2d ago");
    });
});
