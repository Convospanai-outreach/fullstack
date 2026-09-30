import { prisma } from "@/lib/db";
import { localMonth } from "./localDay";

// Team.monthlyMeetingGoal and progress against it for Home. Months are local calendar
// months (localDay's zone), and a meeting counts toward the month it was booked in.

export const MAX_MONTHLY_MEETING_GOAL = 1000;

export interface MeetingPace {
    /** Meetings a steady pace would have booked by today: goal × dayOfMonth / daysInMonth. */
    expected: number;
    onPace: boolean;
    /** Meetings still needed to be back on pace (rounded up); 0 when on pace. */
    behindBy: number;
}

export function meetingPace(goal: number, booked: number, dayOfMonth: number, daysInMonth: number): MeetingPace {
    const expected = (goal * dayOfMonth) / daysInMonth;
    const behindBy = booked >= expected ? 0 : Math.ceil(expected - booked);
    return { expected, onPace: behindBy === 0, behindBy };
}

export async function getMeetingGoal(teamId: string, now = new Date()) {
    const month = localMonth(now);
    const [team, booked] = await Promise.all([
        prisma.team.findUnique({ where: { id: teamId }, select: { monthlyMeetingGoal: true } }),
        prisma.meeting.count({ where: { teamId, createdAt: { gte: month.start, lt: month.end } } }),
    ]);
    const goal = team?.monthlyMeetingGoal ?? null;

    return {
        goal,
        booked,
        dayOfMonth: month.dayOfMonth,
        daysInMonth: month.daysInMonth,
        pace: goal ? meetingPace(goal, booked, month.dayOfMonth, month.daysInMonth) : null,
    };
}

export async function setMeetingGoal(teamId: string, goal: number | null) {
    await prisma.team.update({ where: { id: teamId }, data: { monthlyMeetingGoal: goal } });
}
