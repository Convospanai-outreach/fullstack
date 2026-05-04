import { NextRequest, NextResponse } from "next/server";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const { userId } = await getCurrentContextFromRequest(req);
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const memberships = await prisma.teamMember.findMany({
            where: { userId },
            include: {
                team: true
            }
        });

        const teams = memberships.map(m => ({
            id: m.team.id,
            name: m.team.name,
            role: m.role
        }));

        return NextResponse.json({ teams });
    } catch (error) {
        console.error("Failed to fetch user teams", error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
