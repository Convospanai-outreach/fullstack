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

    // Scoped by the automation's teamId here too, not just the pre-check above - same
    // anti-pattern already fixed under OPEN-99/109/110/118/120/121/122. AutomationLog
    // has no direct teamId column (only via the automation relation), so the filter
    // goes through that relation.
    const result = await prisma.automationLog.updateMany({
        where: { id: logId, automation: { teamId: ctx.teamId } },
        data: {
            status: "success",
            executedAt: new Date()
        }
    });
    if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const updated = await prisma.automationLog.findUnique({ where: { id: logId } });

    return NextResponse.json({ success: true, log: updated });
}
