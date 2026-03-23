import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

async function validateToken(req: NextRequest) {
    const requiredKey = process.env['EXTENSION_API_KEY'];
    const providedKey = req.headers.get("x-extension-key");
    if (!requiredKey || providedKey !== requiredKey) return null;
    const token = req.headers.get("Authorization");
    if (!token) return null;
    return await prisma.user.findUnique({ where: { id: token } });
}

export async function POST(req: NextRequest) {
    try {
        const user = await validateToken(req);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { taskId, success, result, error } = body;

        if (!taskId) {
            return NextResponse.json({ error: "Missing taskId" }, { status: 400 });
        }

        // Update Job Status
        const job = await prisma.job.update({
            where: { id: taskId },
            data: {
                status: success ? "completed" : "failed",
                result: result || undefined,
                error: error || undefined,
                completedAt: new Date()
            }
        });

        // Trigger side-effects if needed? (e.g. if VIEW_PROFILE success, enrich lead)
        // This is handled by Orchestrator usually, but here we just update DB.

        return NextResponse.json({ success: true, jobId: job.id });

    } catch (error: any) {
        console.error("Error completing extension task:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
