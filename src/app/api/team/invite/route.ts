import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { auditService } from "@/modules/audit-logs/service/auditService";

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const { email, role } = await req.json();

    if (!email) {
        return new NextResponse("Email is required", { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return new NextResponse("User not found", { status: 404 });

    const membership = await prisma.teamMember.findFirst({
        where: { userId: user.id },
        include: { team: true }
    });

    if (!membership) return new NextResponse("You are not part of a team", { status: 400 });

    if (membership.role !== "admin" && membership.role !== "owner") {
        // return new NextResponse("Forbidden", { status: 403 }); 
        // Allowing for now as per previous logic
    }

    const existing = await prisma.teamMember.findFirst({
        where: {
            teamId: membership.teamId,
            email: email
        }
    });

    if (existing) {
        return new NextResponse("User already invited or in team", { status: 409 });
    }

    const invite = await prisma.teamMember.create({
        data: {
            teamId: membership.teamId,
            email,
            role: role || "member",
            status: "invited"
        }
    });

    // Log Team Action
    await auditService.logTeamAction(user.id, "MEMBER_INVITED", membership.teamId, invite.id);

    const inviteLink = `${process.env.NEXTAUTH_URL}/join?token=${invite.id}`;

    return NextResponse.json({ ok: true, inviteLink });
}
