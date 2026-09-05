import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
    const ctx = await getCurrentContext();
    if (!ctx.userId || !ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { messageId, rating, comment } = body;

    if (!messageId || typeof rating !== "number") {
        return NextResponse.json({ error: "messageId and rating required" }, { status: 400 });
    }

    // Message has no teamId of its own - it's only reachable via lead.teamId, the
    // same path app-learnings-server.ts's read side already scopes by. Without this,
    // any authenticated user could forge AgentFeedback against another team's
    // message, poisoning that team's own feedback metrics.
    const message = await prisma.message.findFirst({ where: { id: messageId, lead: { teamId: ctx.teamId } } });
    if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 });

    const feedback = await prisma.agentFeedback.create({
        data: {
            messageId,
            userId: ctx.userId,
            rating,
            comment
        }
    });

    return NextResponse.json({ success: true, feedback });
}
