import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectLinkedInLogin, LinkedInLoginError, linkedInLoginEnabled, verifyLinkedInLoginState } from "@/lib/linkedinLogin";

export const dynamic = "force-dynamic";

const SETTINGS_PATH = "/settings/general";

// LinkedIn skips its consent screen for a member who already allowed the app, so a signed state
// alone isn't enough: the person finishing must be the signed-in user who started it.
export async function GET(req: NextRequest) {
    const baseUrl = process.env["NEXTAUTH_URL"] || req.nextUrl.origin;
    const back = (key: "linkedinLogin" | "linkedinLoginError", value: string) => {
        const url = new URL(SETTINGS_PATH, baseUrl);
        url.searchParams.set(key, value);
        return NextResponse.redirect(url);
    };
    const failed = (error: string) => back("linkedinLoginError", error);

    const code = req.nextUrl.searchParams.get("code");
    if (req.nextUrl.searchParams.get("error")) return failed("LinkedIn sign-in was cancelled.");
    if (!code) return failed("LinkedIn didn't send a sign-in code. Try again.");

    try {
        if (!linkedInLoginEnabled()) return failed("LinkedIn sign-in isn't available.");
        const state = verifyLinkedInLoginState(req.nextUrl.searchParams.get("state"));
        if (!state) return failed("This LinkedIn sign-in link expired. Start again.");

        const userId = (await auth())?.user?.id;
        if (!userId || userId !== state.userId) return failed("Sign in to CraftMyFunnel as the person who started this, then try again.");

        await connectLinkedInLogin({ code, userId });
        return back("linkedinLogin", "connected");
    } catch (error) {
        if (error instanceof LinkedInLoginError) return failed(error.message);
        console.error("[linkedin login connect]", error instanceof Error ? error.message : error);
        return failed("Couldn't connect LinkedIn. Try again.");
    }
}
