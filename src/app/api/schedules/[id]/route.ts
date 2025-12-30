import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
    const { userId, teamId } = await getCurrentContext();
    if (!userId || !teamId) return new NextResponse("Unauthorized", { status: 401 });

    const { id } = params;
    const body = await req.json();

    // Verify ownership
    const existing = await prisma.schedule.findFirst({
        where: { id, teamId }
    });

    if (!existing) return new NextResponse("Not Found", { status: 404 });

    const updated = await prisma.schedule.update({
        where: { id },
        data: body
    });

    return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
    const { userId, teamId } = await getCurrentContext();
    if (!userId || !teamId) return new NextResponse("Unauthorized", { status: 401 });

    const { id } = params;

    const existing = await prisma.schedule.findFirst({
        where: { id, teamId }
    });

    if (!existing) return new NextResponse("Not Found", { status: 404 });

    await prisma.schedule.delete({
        where: { id }
    });

    return new NextResponse("Deleted", { status: 200 });
}
