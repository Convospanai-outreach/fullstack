import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";

export async function GET(req: NextRequest) {
    try {
        const { teamId } = await getCurrentContext();
        if (!teamId) return new NextResponse("Unauthorized", { status: 401 });

        const memories = await prisma.agentMemory.findMany({
            where: { teamId },
        });

        return NextResponse.json(memories);
    } catch (error) {
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const { teamId } = await getCurrentContext();
        if (!teamId) return new NextResponse("Unauthorized", { status: 401 });

        const body = await req.json();
        const { key, value } = body;

        if (!key || !value) {
            return new NextResponse("Key and Value are required", { status: 400 });
        }

        // Upsert logic for common settings
        const existing = await prisma.agentMemory.findFirst({
            where: { teamId, key }
        });

        if (existing) {
            const memory = await prisma.agentMemory.update({
                where: { id: existing.id },
                data: { value }
            });
            return NextResponse.json(memory);
        } else {
            const memory = await prisma.agentMemory.create({
                data: { teamId, key, value }
            });
            return NextResponse.json(memory);
        }
    } catch (error) {
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
