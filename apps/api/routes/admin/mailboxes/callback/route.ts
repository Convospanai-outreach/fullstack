import { NextRequest, NextResponse } from "next/server";
import { APIError, handleAPIError } from "@/lib/apiResponse";
import { GmailMailboxService } from "@/lib/gmailMailboxService";

export async function GET(req: NextRequest) {
    try {
        const url = new URL(req.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        if (!code || !state) {
            throw new APIError("Missing OAuth code or state", 400, "BAD_REQUEST");
        }

        const mailbox = await GmailMailboxService.handleCallback(code, state);
        const appUrl = (process.env["NEXTAUTH_URL"] || "http://localhost:3000").replace(/\/$/, "");
        return NextResponse.redirect(`${appUrl}/settings/team?mailbox=connected&email=${encodeURIComponent(mailbox.emailAddress)}`);
    } catch (error: any) {
        if (error instanceof APIError) return handleAPIError(error);
        const appUrl = (process.env["NEXTAUTH_URL"] || "http://localhost:3000").replace(/\/$/, "");
        return NextResponse.redirect(`${appUrl}/settings/team?mailbox=error`);
    }
}

