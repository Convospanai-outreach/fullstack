import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { checkTeamPermission, TeamRole } from "@/lib/permissions";
import { resolveEnabledFeatureKeys } from "@/lib/hiddenFeaturesReadiness";
import { connectLinkedIn, LinkedInConnectError, linkedInAvailable, verifyLinkedInState } from "@/modules/creator-funnel/linkedinConnect";

export const dynamic = "force-dynamic";

const SETTINGS_PATH = "/settings/social";

// LinkedIn skips its consent screen for a member who already allowed the app, so a signed state
// alone isn't enough: the person finishing the sign-in must be the one who started it, and must
// still be an admin of that workspace with the creator funnel on.
export async function GET(req: NextRequest) {
    const baseUrl = process.env["WEB_BASE_URL"] || process.env["NEXTAUTH_URL"] || req.nextUrl.origin;
    const back = (params: Record<string, string>) => {
        const url = new URL(SETTINGS_PATH, baseUrl);
        for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
        return NextResponse.redirect(url);
    };
    const failed = (error: string) => back({ connected: "false", error });

    const code = req.nextUrl.searchParams.get("code");
    if (req.nextUrl.searchParams.get("error")) return failed("LinkedIn sign-in was cancelled.");
    if (!code) return failed("LinkedIn didn't send a sign-in code. Try again.");

    try {
        const state = verifyLinkedInState(req.nextUrl.searchParams.get("state"));
        if (!state) return failed("This LinkedIn sign-in link expired. Start again.");

        const { userId } = await getCurrentContext();
        if (!userId || userId !== state.userId) return failed("Sign in to CraftMyFunnel as the person who started this, then try again.");
        if (!(await checkTeamPermission(userId, state.teamId, TeamRole.ADMIN))) return failed("Only workspace admins can connect accounts.");
        if (!(await resolveEnabledFeatureKeys(state.teamId)).has("creator-funnel") || !(await linkedInAvailable(state.kind))) {
            return failed("LinkedIn isn't available for this workspace.");
        }

        const connected = await connectLinkedIn({ code, state });
        if (connected === 0) return failed("No LinkedIn pages you manage were found. You need an admin or content admin role on the page.");
        return back({ connected: "true" });
    } catch (error) {
        if (error instanceof LinkedInConnectError) return failed(error.message);
        console.error("[linkedin oauth callback]", error instanceof Error ? error.message : error);
        return failed("Couldn't connect LinkedIn. Try again.");
    }
}
