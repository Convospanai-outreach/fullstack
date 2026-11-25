import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { handleAPIError } from "@/lib/apiResponse";
import { parseBody } from "@/lib/validation/parseBody";

// Same outbound size cap as routes/inbox/reply.
const ReplySchema = z.object({ content: z.string().trim().min(1).max(2200), scheduleInHours: z.union([z.literal(1), z.literal(24)]).optional() });

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { userId, teamId } = await getCurrentContextFromRequest(req);
        if (!userId || !teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { id } = await params;
        const { scheduledInboxReplyStatus } = await import("@/modules/inbox/actionInboxService");
        return NextResponse.json({ scheduled: await scheduledInboxReplyStatus(teamId, id) });
    } catch (error) {
        return handleAPIError(error);
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { userId, teamId } = await getCurrentContextFromRequest(req);
        if (!userId || !teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { id } = await params;
        const { cancelScheduledInboxReply } = await import("@/modules/inbox/actionInboxService");
        await cancelScheduledInboxReply(teamId, id);
        return NextResponse.json({ cancelled: true });
    } catch (error) {
        return handleAPIError(error);
    }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { userId, teamId } = await getCurrentContextFromRequest(req);
        if (!userId || !teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const parsed = await parseBody(req, ReplySchema);
        if (!parsed.ok) return parsed.response;

        const { id } = await params;
        const { sendReply, scheduleInboxReply } = await import("@/modules/inbox/actionInboxService");
        if (parsed.data.scheduleInHours) {
            const result = await scheduleInboxReply({ teamId, userId, messageId: id, content: parsed.data.content,
                sendAt: new Date(Date.now() + parsed.data.scheduleInHours * 3_600_000) });
            return NextResponse.json(result, { status: 202 });
        }
        const message = await sendReply({ teamId, userId, messageId: id, content: parsed.data.content });
        return NextResponse.json(message);
    } catch (error) {
        return handleAPIError(error);
    }
}
