import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { EventStore, SystemEventType } from "@/modules/learning/EventStore";

export async function POST(req: NextRequest) {
    const ctx = await getCurrentContext();
    if (!ctx.userId || !ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { generationId, feedbackType } = body;
    if (!generationId || !feedbackType) {
        return NextResponse.json({ error: "generationId and feedbackType required" }, { status: 400 });
    }

    const generation = await prisma.generation.findUnique({ where: { id: generationId } });
    if (!generation) return NextResponse.json({ error: "Generation not found" }, { status: 404 });

    await EventStore.record({
        type: SystemEventType.USER,
        name: "FEEDBACK_RECEIVED",
        teamId: ctx.teamId,
        actorId: ctx.userId,
        payload: {
            generationId,
            feedbackType
        }
    });

    return NextResponse.json({ success: true });
}
