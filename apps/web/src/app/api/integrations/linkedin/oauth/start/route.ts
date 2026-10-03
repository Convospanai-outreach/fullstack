import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { checkTeamPermission, TeamRole } from "@/lib/permissions";
import { resolveEnabledFeatureKeys } from "@/lib/hiddenFeaturesReadiness";
import { buildLinkedInAuthUrl, linkedInAvailable, type LinkedInConnectKind } from "@/modules/creator-funnel/linkedinConnect";

export const dynamic = "force-dynamic";

// Creator funnel: starts "Connect LinkedIn" (?kind=profile, or ?kind=pages for company pages).
export async function GET(req: NextRequest) {
    try {
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        if (!(await checkTeamPermission(userId, teamId, TeamRole.ADMIN))) {
            return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
        }
        const kind: LinkedInConnectKind = req.nextUrl.searchParams.get("kind") === "pages" ? "pages" : "profile";
        if (!(await resolveEnabledFeatureKeys(teamId)).has("creator-funnel") || !(await linkedInAvailable(kind))) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
        return NextResponse.json({ authUrl: buildLinkedInAuthUrl({ teamId, userId, kind }) });
    } catch (error) {
        console.error("[linkedin oauth start]", error instanceof Error ? error.message : error);
        return NextResponse.json({ error: "Unable to start LinkedIn sign-in." }, { status: 500 });
    }
}
