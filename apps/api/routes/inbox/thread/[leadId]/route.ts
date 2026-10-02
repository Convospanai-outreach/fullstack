import { NextRequest, NextResponse } from "next/server";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { handleAPIError } from "@/lib/apiResponse";

export async function GET(req: NextRequest, { params }: { params: Promise<{ leadId: string }> }) {
    try {
        const { userId, teamId } = await getCurrentContextFromRequest(req);
        if (!userId || !teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { leadId } = await params;
        const { getThread } = await import("@/modules/inbox/actionInboxService");
        return NextResponse.json(await getThread(teamId, leadId));
    } catch (error) {
        return handleAPIError(error);
    }
}
