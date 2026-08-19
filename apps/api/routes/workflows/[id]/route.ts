import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkTeamPermission, TeamRole } from "@/lib/permissions";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const ctx = await getCurrentContext();
    if (!ctx.userId || !ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const workflow = await prisma.workflow.findUnique({
        where: { id, teamId: ctx.teamId }
    });

    if (!workflow) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(workflow);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const ctx = await getCurrentContext();
    if (!ctx.userId || !ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const hasPerm = await checkTeamPermission(ctx.userId, ctx.teamId, TeamRole.ADMIN);
    if (!hasPerm) {
        return NextResponse.json({ error: "Forbidden: Admin permissions required to modify workflows" }, { status: 403 });
    }

    const body = await req.json();
    const { name, description, nodes, edges, isActive } = body;

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
    if (!ctx.userId || !ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const hasPerm = await checkTeamPermission(ctx.userId, ctx.teamId, TeamRole.ADMIN);
    if (!hasPerm) {
        return NextResponse.json({ error: "Forbidden: Admin permissions required to delete workflows" }, { status: 403 });
    }

    await prisma.workflow.delete({
        where: { id, teamId: ctx.teamId }
    });

    return NextResponse.json({ success: true });
}
