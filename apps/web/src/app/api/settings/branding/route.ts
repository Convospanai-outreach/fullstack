import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    try {
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) {
            return NextResponse.json({
                ok: false,
                gated: true,
                message: "Branding customization is not available until a workspace is active.",
            });
        }

        await req.json().catch(() => ({}));

        return NextResponse.json({
            ok: false,
            gated: true,
            message: "Branding customization is not enabled for this workspace yet.",
        });
    } catch (error) {
        console.error("[settings:branding:post]", error);
        return NextResponse.json({
            ok: false,
            gated: true,
            degraded: true,
            message: "Branding settings are temporarily unavailable.",
        });
    }
}
