import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const memberships = await prisma.teamMember.findMany({
            where: { userId: session.user.id },
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
