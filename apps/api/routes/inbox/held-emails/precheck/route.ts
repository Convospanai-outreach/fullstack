import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { APIError, handleAPIError } from "@/lib/apiResponse";
import { authorizeRole, TeamRole } from "@/lib/permissions";
import { checkCampaignTokens } from "@/modules/email-campaigner/service/tokenPrecheck";

// Before starting a campaign: which merge fields in its email steps would be empty or mistyped, for how many
// contacts, with a suggested fix. Reads only; nothing is sent or changed. It lives under /inbox/held-emails
// because the web proxy serves every /campaigns/* path from apps/web, never from this app.
export async function GET(req: Request) {
    try {
        const campaignId = new URL(req.url).searchParams.get("campaignId");
        if (!campaignId) return NextResponse.json({ error: "campaignId is required" }, { status: 400 });
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
        await authorizeRole(userId, teamId, TeamRole.MEMBER);

        const report = await checkCampaignTokens(teamId, campaignId);
        if (!report) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
        return NextResponse.json(report);
    } catch (error) {
        return handleAPIError(error);
    }
}
