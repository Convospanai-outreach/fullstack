import { describe, expect, it, vi, beforeEach } from "vitest";

const mockDb: any = vi.hoisted(() => ({
    team: { findUnique: vi.fn(), update: vi.fn() },
    meeting: { count: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: mockDb }));

import { getMeetingGoal, meetingPace } from "../meetingGoalService";
import { localMonth } from "../localDay";

describe("meetingPace", () => {
    it("is on pace once booked meets goal × day / days-in-month", () => {
        expect(meetingPace(30, 15, 15, 30)).toEqual({ expected: 15, onPace: true, behindBy: 0 });
        expect(meetingPace(30, 20, 15, 30).onPace).toBe(true);
    });

    it("rounds the shortfall up to whole meetings", () => {
        // 10 × 16 / 30 = 5.33 expected; 4 booked needs 2 more to catch up.
        expect(meetingPace(10, 4, 16, 30)).toMatchObject({ onPace: false, behindBy: 2 });
        expect(meetingPace(10, 0, 1, 31)).toMatchObject({ onPace: false, behindBy: 1 });
    });

    it("expects the whole goal on the last day of the month", () => {
        expect(meetingPace(8, 7, 28, 28)).toMatchObject({ expected: 8, behindBy: 1 });
        expect(meetingPace(8, 8, 29, 29)).toMatchObject({ onPace: true, behindBy: 0 });
    });
});

describe("localMonth (Asia/Kolkata)", () => {
    it("uses the IST month, not the UTC one, around midnight", () => {
        // 2026-09-30T20:00Z is already 1 October in IST.
        const oct1 = localMonth(new Date("2026-09-30T20:00:00Z"));
        expect(oct1).toMatchObject({ dayOfMonth: 1, daysInMonth: 31 });
        expect(oct1.start).toEqual(new Date("2026-09-30T18:30:00Z"));
        expect(oct1.end).toEqual(new Date("2026-10-31T18:30:00Z"));

        const sep30 = localMonth(new Date("2026-09-30T18:00:00Z"));
        expect(sep30).toMatchObject({ dayOfMonth: 30, daysInMonth: 30 });
    });

    it("knows February's length, including leap years", () => {
        expect(localMonth(new Date("2027-02-10T06:00:00Z")).daysInMonth).toBe(28);
        expect(localMonth(new Date("2028-02-10T06:00:00Z")).daysInMonth).toBe(29);
    });
});

describe("getMeetingGoal", () => {
    beforeEach(() => vi.clearAllMocks());

    it("counts meetings booked this IST month and computes pace", async () => {
        mockDb.team.findUnique.mockResolvedValue({ monthlyMeetingGoal: 10 });
        mockDb.meeting.count.mockResolvedValue(4);

        const result = await getMeetingGoal("team-a", new Date("2026-09-16T06:00:00Z"));

        expect(mockDb.meeting.count).toHaveBeenCalledWith({
            where: { teamId: "team-a", createdAt: { gte: new Date("2026-08-31T18:30:00Z"), lt: new Date("2026-09-30T18:30:00Z") } },
        });
        expect(result).toMatchObject({ goal: 10, booked: 4, dayOfMonth: 16, daysInMonth: 30, pace: { onPace: false, behindBy: 2 } });
    });

    it("returns no pace until a goal is set", async () => {
        mockDb.team.findUnique.mockResolvedValue({ monthlyMeetingGoal: null });
        mockDb.meeting.count.mockResolvedValue(3);

        expect(await getMeetingGoal("team-a")).toMatchObject({ goal: null, booked: 3, pace: null });
    });
});
