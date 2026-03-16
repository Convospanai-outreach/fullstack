import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
    const ctx = await getCurrentContext();
    if (!ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const memories = await prisma.agentMemory.findMany({
        where: { teamId: ctx.teamId },
        orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({ memories });
}

export async function POST(req: NextRequest) {
    const ctx = await getCurrentContext();
    if (!ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    if (body?.key && body?.value) {
        const memory = await prisma.agentMemory.create({
            data: {
                teamId: ctx.teamId,
                key: body.key,
                value: body.value,
                confidence: typeof body.confidence === "number" ? body.confidence : 1
            }
        });
        return NextResponse.json({ success: true, memory });
    }

    const memories = await prisma.agentMemory.findMany({
        where: { teamId: ctx.teamId },
        orderBy: { createdAt: "desc" }
    });
    return NextResponse.json({ memories });
}
