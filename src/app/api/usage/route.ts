import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { usageService } from "@/modules/usage/usageService";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
    const ctx = await getCurrentContext();
    if (!ctx.teamId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const usage = await usageService.getTeamUsage(ctx.teamId);
        return NextResponse.json({ usage });
    } catch (error) {
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
