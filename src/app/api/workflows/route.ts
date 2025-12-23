import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
    const ctx = await getCurrentContext();
    if (!ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const workflows = await prisma.workflow.findMany({
        where: { teamId: ctx.teamId },
        orderBy: { updatedAt: 'desc' }
    });

    return NextResponse.json(workflows);
}

export async function POST(req: NextRequest) {
    const ctx = await getCurrentContext();
    if (!ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { name, description } = body;

    // Default template for a new workflow
    const defaultNodes = [
        {
            id: 'start-1',
            type: 'trigger',
            data: { label: 'Start Trigger' },
            position: { x: 250, y: 50 },
        }
    ];

    const workflow = await prisma.workflow.create({
        data: {
            teamId: ctx.teamId,
            name: name || "Untitled Workflow",
            description,
            nodes: defaultNodes,
            edges: [],
            isActive: false
        }
    });

    return NextResponse.json(workflow);
}
