import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { handleAPIError } from "@/lib/apiResponse";
import { parseBody } from "@/lib/validation/parseBody";
import { checkTeamPermission, TeamRole } from "@/lib/permissions";

// Keep in sync with MAX_MONTHLY_MEETING_GOAL (meetingGoalService); not imported here so the
// service stays lazy-loaded.
const GoalSchema = z.object({ goal: z.number().int().min(1).max(1000).nullable() });

// Home's monthly meeting goal card: the team goal, meetings booked this month, and pace.
export async function GET(req: NextRequest) {
    try {
        const { userId, teamId } = await getCurrentContextFromRequest(req);
        if (!userId || !teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { getMeetingGoal } = await import("@/modules/inbox/meetingGoalService");
        return NextResponse.json(await getMeetingGoal(teamId));
    } catch (error) {
        return handleAPIError(error);
    }
}

// Set or clear (goal: null) the team's goal. Any team member can, same as the setup wizard.
export async function PUT(req: NextRequest) {
    try {
        const { userId, teamId } = await getCurrentContextFromRequest(req);
        if (!userId || !teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        if (!(await checkTeamPermission(userId, teamId, TeamRole.MEMBER))) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const parsed = await parseBody(req, GoalSchema);
        if (!parsed.ok) return parsed.response;

        const { getMeetingGoal, setMeetingGoal } = await import("@/modules/inbox/meetingGoalService");
        await setMeetingGoal(teamId, parsed.data.goal);
        return NextResponse.json(await getMeetingGoal(teamId));
    } catch (error) {
        return handleAPIError(error);
    }
}
