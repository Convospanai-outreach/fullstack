import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
    const ctx = await getCurrentContext();
    if (!ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { logId } = body;
    if (!logId) return NextResponse.json({ error: "logId required" }, { status: 400 });

    const log = await prisma.automationLog.findUnique({
        where: { id: logId },
        include: { automation: true }
    });

    if (!log || log.automation.teamId !== ctx.teamId) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updated = await prisma.automationLog.update({
        where: { id: logId },
        data: {
            status: "success",
            executedAt: new Date()
        }
    });

    return NextResponse.json({ success: true, log: updated });
}
