import { NextRequest, NextResponse } from "next/server";
import { connectGoogleMailbox, sanitizeRelativePath } from "@/modules/email-campaigner/service/googleMailboxService";

export async function GET(req: NextRequest) {
    const code = req.nextUrl.searchParams.get("code");
    const state = req.nextUrl.searchParams.get("state");
    const error = req.nextUrl.searchParams.get("error");

    if (error) {
        return NextResponse.json({ error }, { status: 400 });
    }
    if (!code || !state) {
        return NextResponse.json({ error: "Missing Google OAuth code or state." }, { status: 400 });
    }

    try {
        const result = await connectGoogleMailbox({ code, state });
        const baseUrl = process.env["WEB_BASE_URL"] || process.env["NEXTAUTH_URL"];
        if (baseUrl) {
            const redirectUrl = new URL(sanitizeRelativePath(result.nextPath), baseUrl);
            redirectUrl.searchParams.set("googleMailbox", "connected");
            return NextResponse.redirect(redirectUrl);
        }
        return NextResponse.json({
            success: true,
            mailbox: {
                id: result.mailbox.id,
                email: result.mailbox.email,
                status: result.mailbox.status,
            },
        });
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || "Unable to connect Google mailbox." }, { status: 500 });
    }
}
