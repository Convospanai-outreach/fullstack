import { NextRequest, NextResponse } from "next/server";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { handleAPIError } from "@/lib/apiResponse";

// Home's "Needs you" list: what's waiting on the user in their current team, with the top
// entries of each and a link to act. Same queries as the daily digest (needsYouService).
export async function GET(req: NextRequest) {
    try {
        const { userId, teamId } = await getCurrentContextFromRequest(req);
        if (!userId || !teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { markActiveDay } = await import("@/lib/analytics/productEvents");
        void markActiveDay(userId, teamId);

        // The full draft text goes only to people who can sign it off (the same permission the approve and
        // reject actions need); everyone else still sees the counts and titles.
        const { hasPermission, Permission } = await import("@/lib/permissions");
        const includeDraft = await hasPermission(userId, teamId, Permission.RESOLVE_APPROVALS);

        const { collectNeedsYou } = await import("@/modules/inbox/needsYouService");
        return NextResponse.json({ needsYou: await collectNeedsYou([teamId], new Date(), { includeDraft }) });
    } catch (error) {
        return handleAPIError(error);
    }
}
