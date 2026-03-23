import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
    const ctx = await getCurrentContext();
    if (!ctx.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { messageId, rating, comment } = body;

    if (!messageId || typeof rating !== "number") {
        return NextResponse.json({ error: "messageId and rating required" }, { status: 400 });
    }

    const message = await prisma.message.findUnique({ where: { id: messageId } });
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
