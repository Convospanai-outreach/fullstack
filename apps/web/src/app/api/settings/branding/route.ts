import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    const { userId, teamId } = await getCurrentContext();
    if (!userId || !teamId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await req.json().catch(() => ({}));

    return NextResponse.json({
        ok: false,
        gated: true,
        message: "Branding customization is not enabled for this workspace yet.",
    });
}
