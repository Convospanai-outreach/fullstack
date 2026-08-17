import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const ctx = await getCurrentContext();
    if (!ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { prisma } = await import("@/lib/db");
    const workflow = await prisma.workflow.findUnique({
        where: { id, teamId: ctx.teamId }
    });

    if (!workflow) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(workflow);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const ctx = await getCurrentContext();
    if (!ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { name, description, nodes, edges, isActive } = body;

    const { prisma } = await import("@/lib/db");
    const workflow = await prisma.workflow.update({
        where: { id, teamId: ctx.teamId },
        data: {
            name,
            description,
            nodes,   // ReactFlow nodes JSON
            edges,   // ReactFlow edges JSON
            isActive
        }
    });

    return NextResponse.json(workflow);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const ctx = await getCurrentContext();
    if (!ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { prisma } = await import("@/lib/db");
    await prisma.workflow.delete({
        where: { id, teamId: ctx.teamId }
    });

    return NextResponse.json({ success: true });
}
