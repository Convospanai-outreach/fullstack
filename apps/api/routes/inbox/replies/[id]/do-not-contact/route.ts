import { NextRequest, NextResponse } from "next/server";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { handleAPIError } from "@/lib/apiResponse";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { userId, teamId } = await getCurrentContextFromRequest(req);
        if (!userId || !teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { id } = await params;
        const { markReplyDoNotContact } = await import("@/modules/inbox/actionInboxService");
        return NextResponse.json(await markReplyDoNotContact(teamId, id, userId));
    } catch (error) {
        return handleAPIError(error);
    }
}
