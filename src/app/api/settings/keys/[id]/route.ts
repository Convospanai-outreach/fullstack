import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    const ctx = await getCurrentContext();
    if (!ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Ensure key belongs to team
    const key = await prisma.apiKey.findFirst({
        where: { id: params.id, teamId: ctx.teamId }
    });

    if (!key) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.apiKey.delete({
        where: { id: params.id }
    });

    return NextResponse.json({ success: true });
}
