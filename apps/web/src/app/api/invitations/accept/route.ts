import { NextRequest, NextResponse } from "next/server";
import { findValidInvitation } from "@/lib/invitations";

export async function GET(req: NextRequest) {
    const token = req.nextUrl.searchParams.get("token") || "";
    if (!token) {
        return NextResponse.json({ valid: false, error: "Invitation token is required." }, { status: 400 });
    }

    const { invitation, error } = await findValidInvitation(token);
    if (!invitation) {
        return NextResponse.json({ valid: false, error }, { status: 400 });
    }

    return NextResponse.json({
        valid: true,
        invitation: {
            email: invitation.email,
            role: invitation.role,
            teamName: invitation.team.name,
            expiresAt: invitation.expiresAt
        }
    });
}

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => null);
    const token = typeof body?.token === "string" ? body.token : "";
    const redirectTo = token ? `/signup?token=${encodeURIComponent(token)}` : "/signup";

    return NextResponse.json({
        error: "Password-based invitation acceptance is disabled. Use Clerk signup to accept the invitation.",
        redirectTo
    }, { status: 410 });
}
