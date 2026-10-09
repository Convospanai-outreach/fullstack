import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateExtensionAuth } from "../../_lib/auth";

export async function GET(req: NextRequest) {
    const auth = await validateExtensionAuth(req);
    if (!auth.ok) {
        return NextResponse.json({ valid: false, error: auth.error, code: auth.code }, { status: auth.status });
    }
    // The team leads will be saved to, when that's settled (a token generated in a team, or a
    // user with one team). The popup shows it so it can be checked against the setup page.
    const team = auth.teamIds.length === 1
        ? await prisma.team.findUnique({ where: { id: auth.teamIds[0]! }, select: { id: true, name: true } })
        : null;
    return NextResponse.json({
        valid: true,
        user: {
            id: auth.user.id,
            email: auth.user.email,
            name: auth.user.name
        },
        teamIds: auth.teamIds,
        team
    });
}
