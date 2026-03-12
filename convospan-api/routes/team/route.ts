import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user?.email) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const user = await prisma.user.findUnique({ where: { email: session.user.email } });
        if (!user) return new NextResponse("User not found", { status: 404 });

        // Find existing membership
        let teamMember = await prisma.teamMember.findFirst({
            where: { userId: user.id },
            include: { team: { include: { members: true } } }
        });

        if (!teamMember) {
            // Create default team
            const team = await prisma.team.create({
                data: {
                    name: `${user.name || "My"}'s Workspace`,
                    members: {
                        create: {
                            userId: user.id,
                            email: user.email,
                            role: "owner",
                            status: "active"
                        }
                    }
                },
                include: { members: true }
            });
            return NextResponse.json(team);
        }

        return NextResponse.json(teamMember.team);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}


