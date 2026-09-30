import { NextRequest, NextResponse } from "next/server";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { handleAPIError } from "@/lib/apiResponse";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { userId, teamId } = await getCurrentContextFromRequest(req);
        if (!userId || !teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { id } = await params;
        const { markReplyRead } = await import("@/modules/inbox/actionInboxService");
        await markReplyRead(teamId, id);
        return NextResponse.json({ success: true });
    } catch (error) {
        return handleAPIError(error);
    }
}
