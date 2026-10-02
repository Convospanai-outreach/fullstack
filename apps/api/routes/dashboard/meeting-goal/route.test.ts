import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({ getCurrentContextFromRequest: vi.fn() }));
vi.mock("@/lib/permissions", () => ({ checkTeamPermission: vi.fn(), TeamRole: { MEMBER: "member" } }));
vi.mock("@/modules/inbox/meetingGoalService", () => ({
    getMeetingGoal: vi.fn().mockResolvedValue({ goal: 12, booked: 3, pace: null }),
    setMeetingGoal: vi.fn().mockResolvedValue(undefined),
}));

import { GET, PUT } from "./route";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { checkTeamPermission } from "@/lib/permissions";
import { getMeetingGoal, setMeetingGoal } from "@/modules/inbox/meetingGoalService";

const put = (body: unknown) =>
    new NextRequest("http://localhost:3001/dashboard/meeting-goal", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

describe("/dashboard/meeting-goal", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (getCurrentContextFromRequest as any).mockResolvedValue({ userId: "user-1", teamId: "team-a" });
        (checkTeamPermission as any).mockResolvedValue(true);
    });

    it("401s without a team context", async () => {
        (getCurrentContextFromRequest as any).mockResolvedValue({ userId: "user-1", teamId: null });

        expect((await GET(new NextRequest("http://localhost:3001/dashboard/meeting-goal"))).status).toBe(401);
        expect((await PUT(put({ goal: 5 }))).status).toBe(401);
        expect(setMeetingGoal).not.toHaveBeenCalled();
    });

    it("reads the caller's team goal", async () => {
        await GET(new NextRequest("http://localhost:3001/dashboard/meeting-goal"));

        expect(getMeetingGoal).toHaveBeenCalledWith("team-a");
    });

    it("sets and clears the goal for the caller's team", async () => {
        expect((await PUT(put({ goal: 12 }))).status).toBe(200);
        expect(setMeetingGoal).toHaveBeenCalledWith("team-a", 12);

        await PUT(put({ goal: null }));
        expect(setMeetingGoal).toHaveBeenCalledWith("team-a", null);
    });

    it("rejects goals that aren't a whole number from 1 to 1000", async () => {
        for (const goal of [0, -3, 2.5, 1001, "10"]) {
            expect((await PUT(put({ goal }))).status, String(goal)).toBe(400);
        }
        expect(setMeetingGoal).not.toHaveBeenCalled();
    });

    it("403s for someone without a team role", async () => {
        (checkTeamPermission as any).mockResolvedValue(false);

        expect((await PUT(put({ goal: 5 }))).status).toBe(403);
        expect(setMeetingGoal).not.toHaveBeenCalled();
    });
});
