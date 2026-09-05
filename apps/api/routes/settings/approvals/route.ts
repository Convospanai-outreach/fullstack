import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
    const { userId, teamId } = await getCurrentContext();
    if (!userId || !teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const requests = await prisma.approvalRequest.findMany({
            where: { teamId },
            orderBy: { createdAt: 'desc' },
            take: 50
        });

        return NextResponse.json(requests);
    } catch (error) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
