import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { checkTeamPermission, TeamRole } from "@/lib/permissions";
import { buildMicrosoftMailboxAuthUrl } from "@/modules/email-campaigner/service/microsoftMailboxService";

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

    const nextPath = req.nextUrl.searchParams.get("next") || req.nextUrl.searchParams.get("state");
    const authUrl = buildMicrosoftMailboxAuthUrl(nextPath ? { teamId, userId, nextPath } : { teamId, userId });

    return NextResponse.redirect(authUrl, { status: 302 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Unable to start Microsoft OAuth." }, { status: 500 });
  }
}
