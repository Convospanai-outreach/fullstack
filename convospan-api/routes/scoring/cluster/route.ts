import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { predictiveService } from "@/modules/scoring";

export async function POST(_req: NextRequest) {
    const ctx = await getCurrentContext();
    if (!ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const result = await predictiveService.clusterCustomers(ctx.teamId);
    return NextResponse.json(result);
}
