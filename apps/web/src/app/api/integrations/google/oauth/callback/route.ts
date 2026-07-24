import { NextRequest, NextResponse } from "next/server";
import { connectGoogleMailbox, sanitizeRelativePath } from "@/modules/email-campaigner/service/googleMailboxService";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const code = req.nextUrl.searchParams.get("code");
    const state = req.nextUrl.searchParams.get("state");
    const error = req.nextUrl.searchParams.get("error");
    const baseUrl = process.env["WEB_BASE_URL"] || process.env["NEXTAUTH_URL"] || req.nextUrl.origin;

    if (error) {
        return NextResponse.redirect(
            new URL(`/settings/mailboxes?connected=false&error=${encodeURIComponent(error)}`, baseUrl)
        );
    }
    if (!code || !state) {
        return NextResponse.redirect(
            new URL("/settings/mailboxes?connected=false&error=missing_oauth_code", baseUrl)
        );
    }

    try {
        const result = await connectGoogleMailbox({ code, state });
        const targetPath = result.nextPath
            ? sanitizeRelativePath(result.nextPath)
            : "/settings/mailboxes";
        const redirectUrl = new URL(targetPath, baseUrl);
        redirectUrl.searchParams.set("connected", "true");
        if (result.mailbox?.email) {
            redirectUrl.searchParams.set("email", result.mailbox.email);
        }
        return NextResponse.redirect(redirectUrl);
    } catch (err: any) {
        const message = err?.message || "oauth_failed";
        return NextResponse.redirect(
            new URL(`/settings/mailboxes?connected=false&error=${encodeURIComponent(message)}`, baseUrl)
        );
    }
}
