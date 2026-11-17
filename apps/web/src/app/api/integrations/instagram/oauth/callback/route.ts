import { NextRequest, NextResponse } from "next/server";
import { nextPathFromState } from "@/modules/facebook-leads/service/facebookLeadsService";
import { connectInstagramLogin } from "@/modules/instagram-login/service/instagramLoginService";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const code = req.nextUrl.searchParams.get("code");
    const state = req.nextUrl.searchParams.get("state");
    const error = req.nextUrl.searchParams.get("error");
    const baseUrl = process.env["WEB_BASE_URL"] || process.env["NEXTAUTH_URL"] || req.nextUrl.origin;
    // Failures return to the page that started the connect (verified state), else the social accounts page.
    const failurePath = nextPathFromState(state) || "/settings/social";
    const failure = (message: string) => NextResponse.redirect(new URL(`${failurePath}?connected=false&error=${encodeURIComponent(message)}`, baseUrl));

    if (error) return failure(req.nextUrl.searchParams.get("error_description") || error);
    if (!code || !state) return failure("missing_oauth_code");

    try {
        const result = await connectInstagramLogin({ code, state });
        const redirectUrl = new URL(result.nextPath || "/settings/social", baseUrl);
        redirectUrl.searchParams.set("connected", "true");
        redirectUrl.searchParams.set("pages", String(result.pages.length));
        return NextResponse.redirect(redirectUrl);
    } catch (err: any) {
        return failure(err?.message || "oauth_failed");
    }
}
