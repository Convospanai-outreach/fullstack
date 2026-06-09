import { NextResponse } from "next/server";
import { findOrCreateClerkAppUser } from "@/lib/clerkAuth";

export async function GET() {
    const user = await findOrCreateClerkAppUser();
    if (!user) {
        return NextResponse.json({ error: "Invite approval required." }, { status: 403 });
    }

    return NextResponse.json({
        ok: true,
        user: {
            id: user.id,
            email: user.email,
            enterpriseRole: user.enterpriseRole
        }
    });
}
