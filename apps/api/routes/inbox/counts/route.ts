import { NextRequest, NextResponse } from "next/server";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { handleAPIError } from "@/lib/apiResponse";

// Lightweight badge counts for the sidebar, which polls this every 60s.
export async function GET(req: NextRequest) {
    try {
        const { userId, teamId } = await getCurrentContextFromRequest(req);
        if (!userId || !teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { getInboxCounts } = await import("@/modules/inbox/actionInboxService");
        return NextResponse.json(await getInboxCounts(teamId));
    } catch (error) {
        return handleAPIError(error);
    }
}
