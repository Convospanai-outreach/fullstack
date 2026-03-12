import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest) {
    const ctx = await getCurrentContext();
    if (!ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const members = await prisma.teamMember.findMany({
        where: { teamId: ctx.teamId },
        include: { user: { select: { name: true, image: true } } }
    });

    return NextResponse.json(members);
}

// Invite Member (Mock for now or simple DB insert)
export async function POST(req: NextRequest) {
    const ctx = await getCurrentContext();
    if (!ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Check permission (mock)
    // if (ctx.role !== 'admin') ...

    const { email, role } = await req.json();

    const existing = await prisma.teamMember.findFirst({
        where: { teamId: ctx.teamId, email }
    });

    if (existing) return NextResponse.json({ error: "User already in team" }, { status: 400 });

    const member = await prisma.teamMember.create({
        data: {
            teamId: ctx.teamId,
            email,
            role: role || 'member',
            status: 'invited'
        }
    });

    return NextResponse.json(member);
}
