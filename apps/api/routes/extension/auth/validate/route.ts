import { NextRequest, NextResponse } from "next/server";
import { validateExtensionAuth } from "../../_lib/auth";

export async function GET(req: NextRequest) {
    const auth = await validateExtensionAuth(req);
    if (!auth.ok) {
        return NextResponse.json({ valid: false, error: auth.error }, { status: auth.status });
    }
    return NextResponse.json({
        valid: true,
        user: {
            id: auth.user.id,
            email: auth.user.email,
            name: auth.user.name
        },
        teamIds: auth.teamIds
    });
}
