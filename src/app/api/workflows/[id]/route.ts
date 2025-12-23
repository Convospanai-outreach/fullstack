import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    const ctx = await getCurrentContext();
    if (!ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const workflow = await prisma.workflow.findUnique({
        where: { id: params.id, teamId: ctx.teamId }
    });

    if (!workflow) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(workflow);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    const ctx = await getCurrentContext();
    if (!ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { name, description, nodes, edges, isActive } = body;

    const workflow = await prisma.workflow.update({
        where: { id: params.id, teamId: ctx.teamId },
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

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    const ctx = await getCurrentContext();
    if (!ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await prisma.workflow.delete({
        where: { id: params.id, teamId: ctx.teamId }
    });

    return NextResponse.json({ success: true });
}
