import { NextRequest, NextResponse } from "next/server";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { handleAPIError } from "@/lib/apiResponse";

// Action Inbox: inbound replies (paginated, newest first), open Overseer nudges,
// meetings in the next 48h, and the badge counts. See modules/inbox/actionInboxService.ts.
export async function GET(req: NextRequest) {
    try {
        const { userId, teamId } = await getCurrentContextFromRequest(req);
        if (!userId || !teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const url = new URL(req.url);
        const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1);
        const limit = Math.min(50, Math.max(1, Number.parseInt(url.searchParams.get("limit") || "20", 10) || 20));

        const { getInbox } = await import("@/modules/inbox/actionInboxService");
        return NextResponse.json(await getInbox(teamId, { page, limit }));
    } catch (error) {
        return handleAPIError(error);
    }
}
