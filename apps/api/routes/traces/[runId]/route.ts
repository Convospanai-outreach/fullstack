import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ runId: string }> }
) {
    const { runId } = await params;
    const { userId, teamId } = await getCurrentContext();
    if (!userId || !teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const traces = await prisma.aiTrace.findMany({
            where: { runId },
            orderBy: { createdAt: 'asc' }
        });

        // Map to Visualizer format
        const formattedTraces = traces.map(t => ({
            name: t.stepName,
            thought: t.reasoning || "No reasoning captured",
            input: t.input || undefined,
            output: t.output || undefined,
            duration: t.latency,
            tokens: t.tokens
        }));

        return NextResponse.json(formattedTraces);
    } catch (error) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
