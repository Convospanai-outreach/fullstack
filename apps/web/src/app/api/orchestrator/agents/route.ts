import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const ctx = await getCurrentContext();
        if (!ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { prisma } = await import("@/lib/db");

        const agents = await prisma.agent.findMany({
            orderBy: { updatedAt: "desc" }
        });
        return NextResponse.json(agents);
    } catch (error) {
        console.error("[orchestrator/agents] Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
