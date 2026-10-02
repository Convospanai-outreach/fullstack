import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { handleAPIError } from "@/lib/apiResponse";
import { parseBody } from "@/lib/validation/parseBody";

// Same outbound size cap as routes/inbox/reply.
const ReplySchema = z.object({ content: z.string().trim().min(1).max(2200) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { userId, teamId } = await getCurrentContextFromRequest(req);
        if (!userId || !teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const parsed = await parseBody(req, ReplySchema);
        if (!parsed.ok) return parsed.response;

        const { id } = await params;
        const { sendReply } = await import("@/modules/inbox/actionInboxService");
        const message = await sendReply({ teamId, userId, messageId: id, content: parsed.data.content });
        return NextResponse.json(message);
    } catch (error) {
        return handleAPIError(error);
    }
}
