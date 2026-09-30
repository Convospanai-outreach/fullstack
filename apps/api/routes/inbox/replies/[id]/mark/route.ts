import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { handleAPIError } from "@/lib/apiResponse";
import { parseBody } from "@/lib/validation/parseBody";
import { REPLY_OUTCOMES } from "@/modules/inbox/actionInboxService";

const MarkSchema = z.object({ outcome: z.enum(REPLY_OUTCOMES) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { userId, teamId } = await getCurrentContextFromRequest(req);
        if (!userId || !teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const parsed = await parseBody(req, MarkSchema);
        if (!parsed.ok) return parsed.response;

        const { id } = await params;
        const { markReplyOutcome } = await import("@/modules/inbox/actionInboxService");
        const result = await markReplyOutcome(teamId, id, parsed.data.outcome);

        const { markFirstPositiveReply } = await import("@/lib/analytics/productEvents");
        void markFirstPositiveReply(teamId, userId, parsed.data.outcome);
        return NextResponse.json(result);
    } catch (error) {
        return handleAPIError(error);
    }
}
