import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { checkTeamPermission, TeamRole } from "@/lib/permissions";
import { buildGoogleMailboxAuthUrl, sanitizeRelativePath } from "@/modules/email-campaigner/service/googleMailboxService";

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

        const nextPath = sanitizeRelativePath(req.nextUrl.searchParams.get("next"));
        const authUrl = await buildGoogleMailboxAuthUrl({
            teamId,
            userId,
            nextPath,
        });

        return NextResponse.json({ authUrl });
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || "Unable to start Google OAuth." }, { status: 500 });
    }
}
