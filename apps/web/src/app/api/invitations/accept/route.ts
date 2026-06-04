import { NextRequest, NextResponse } from "next/server";
import { acceptInvitation, findValidInvitation } from "@/lib/invitations";

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
    try {
        const body = await req.json();
        const token = typeof body.token === "string" ? body.token : "";
        const password = typeof body.password === "string" ? body.password : "";
        const name = typeof body.name === "string" ? body.name.trim() : "";

        if (!token) {
            return NextResponse.json({ error: "Invitation token is required." }, { status: 400 });
        }

        if (password.length < 8) {
            return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
        }

        await acceptInvitation(token, { name, password });
        return NextResponse.json({ ok: true, redirectTo: "/login" });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to accept invitation.";
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
