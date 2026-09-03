import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { checkTeamPermission, TeamRole } from "@/lib/permissions";
import { buildFacebookLeadsAuthUrl } from "@/modules/facebook-leads/service/facebookLeadsService";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        if (!(await checkTeamPermission(userId, teamId, TeamRole.ADMIN))) {
            return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
        }

        const nextPath = req.nextUrl.searchParams.get("next");
        const authUrl = buildFacebookLeadsAuthUrl({ teamId, userId, ...(nextPath ? { nextPath } : {}) });

        return NextResponse.json({ authUrl });
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || "Unable to start Facebook OAuth." }, { status: 500 });
    }
}
