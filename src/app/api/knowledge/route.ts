import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";

export async function GET(req: NextRequest) {
    const { teamId } = await getCurrentContext();
    if (!teamId) return new NextResponse("Unauthorized", { status: 401 });

    const kbs = await prisma.knowledgeBase.findMany({
        where: { teamId },
        include: {
            _count: {
                select: { items: true }
            }
        },
        orderBy: { createdAt: "desc" }
    });

    return NextResponse.json(kbs);
}

export async function POST(req: NextRequest) {
    const { teamId } = await getCurrentContext();
    if (!teamId) return new NextResponse("Unauthorized", { status: 401 });

    try {
        const { name, description } = await req.json();
        if (!name) return new NextResponse("Name is required", { status: 400 });

        const kb = await prisma.knowledgeBase.create({
            data: {
                name,
                description,
                teamId
            }
        });

        return NextResponse.json(kb);
    } catch (error: any) {
        return new NextResponse(error.message, { status: 500 });
    }
}
