import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { checkTeamPermission, TeamRole } from "@/lib/permissions";
import { buildInstagramLoginAuthUrl } from "@/modules/instagram-login/service/instagramLoginService";
import { resolveEnabledFeatureKeys } from "@/lib/hiddenFeaturesReadiness";
import { internalErrorMessage } from "@/lib/internalError";

export const dynamic = "force-dynamic";

// "Connect Instagram only" (Instagram Login, no Facebook Page) for the creator funnel.
export async function GET(req: NextRequest) {
    try {
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        if (!(await checkTeamPermission(userId, teamId, TeamRole.ADMIN))) {
            return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
        }
        if (!(await resolveEnabledFeatureKeys(teamId)).has("creator-funnel")) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        const nextPath = req.nextUrl.searchParams.get("next");
        const authUrl = buildInstagramLoginAuthUrl({ teamId, userId, ...(nextPath ? { nextPath } : {}) });
        return NextResponse.json({ authUrl });
    } catch (error: any) {
        return NextResponse.json({ error: internalErrorMessage(error, "Unable to start Instagram sign-in.") }, { status: 500 });
    }
}
