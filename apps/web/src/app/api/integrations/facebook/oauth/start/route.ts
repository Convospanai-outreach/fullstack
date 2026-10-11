import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { checkTeamPermission, TeamRole } from "@/lib/permissions";
import { buildFacebookLeadsAuthUrl } from "@/modules/facebook-leads/service/facebookLeadsService";
import { resolveEnabledFeatureKeys } from "@/lib/hiddenFeaturesReadiness";

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
        // "social" (creator funnel) asks for posting, comment and messaging permissions.
        const purpose = req.nextUrl.searchParams.get("purpose") === "social" ? "social" : "leads";
        if (purpose === "social" && !(await resolveEnabledFeatureKeys(teamId)).has("creator-funnel")) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
        // "business=1": the Page role comes through Business Manager (social only).
        const businessManager = purpose === "social" && req.nextUrl.searchParams.get("business") === "1";
        const authUrl = buildFacebookLeadsAuthUrl({ teamId, userId, purpose, ...(nextPath ? { nextPath } : {}), ...(businessManager ? { businessManager } : {}) });

        return NextResponse.json({ authUrl });
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || "Unable to start Facebook OAuth." }, { status: 500 });
    }
}
