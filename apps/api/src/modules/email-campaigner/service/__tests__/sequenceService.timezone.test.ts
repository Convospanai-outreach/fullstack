import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/modules/email-campaigner", () => ({ emailService: {} }));
vi.mock("../googleMailboxService", () => ({
    assertMailboxCanSend: vi.fn(),
    isSuppressed: vi.fn(),
}));

import { computeScheduledAt } from "../sequenceService";

describe("computeScheduledAt", () => {
    it("adds hour-only delays as plain duration regardless of timezone", () => {
        const now = new Date("2026-03-10T12:00:00.000Z");
        const result = computeScheduledAt(now, { delayDays: 0, delayHours: 5 }, "America/New_York");
        expect(result.toISOString()).toBe("2026-03-10T17:00:00.000Z");
    });

    it("defaults to UTC when no timezone is provided", () => {
        const now = new Date("2026-01-01T09:00:00.000Z");
        const result = computeScheduledAt(now, { delayDays: 2, delayHours: 0 }, undefined);
        expect(result.toISOString()).toBe("2026-01-03T09:00:00.000Z");
    });

    it("preserves local wall-clock time across a US DST spring-forward boundary", () => {
        // 2026-03-08 00:00 America/New_York is EST (UTC-5) -> 05:00Z.
        // +2 days lands on 2026-03-10, which is EDT (UTC-4) after the Mar 8 2am spring-forward.
        // Preserving local 00:00 means the UTC instant shifts by only 47h, not 48h.
        const now = new Date("2026-03-08T05:00:00.000Z");
        const result = computeScheduledAt(now, { delayDays: 2, delayHours: 0 }, "America/New_York");
        expect(result.toISOString()).toBe("2026-03-10T04:00:00.000Z");
    });

    it("preserves local wall-clock time across a US DST fall-back boundary", () => {
        // 2026-10-30 09:00 America/New_York is EDT (UTC-4) -> 13:00Z.
        // +2 days lands on 2026-11-01, which is EST (UTC-5) after the Nov 1 2am fall-back.
        // Preserving local 09:00 means the UTC instant shifts by 49h, not 48h.
        const now = new Date("2026-10-30T13:00:00.000Z");
        const result = computeScheduledAt(now, { delayDays: 2, delayHours: 0 }, "America/New_York");
        expect(result.toISOString()).toBe("2026-11-01T14:00:00.000Z");
    });

    it("combines day and hour delays", () => {
        const now = new Date("2026-06-01T08:00:00.000Z");
        const result = computeScheduledAt(now, { delayDays: 1, delayHours: 3 }, "UTC");
        expect(result.toISOString()).toBe("2026-06-02T11:00:00.000Z");
    });
});
