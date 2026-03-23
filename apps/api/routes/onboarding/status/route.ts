import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { onboardingService } from "@/modules/onboarding/service/onboardingService";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    // Get Team ID (assuming user has one team or just grabbing the first one for now)
    // Refactor: We should store activeTeamId in session or cookie. For now, fetch via query or user's first team.
    const member = await prisma.teamMember.findFirst({
        where: { user: { email: session.user.email } },
        select: { teamId: true }
    });

    if (!member) return NextResponse.json([]); // No team, no onboarding progress tracked yet

    const status = await onboardingService.getOnboardingStatus(session.user.id, member.teamId);
    return NextResponse.json(status);
}
