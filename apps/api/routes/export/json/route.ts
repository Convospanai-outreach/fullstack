import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { exportService } from "@/modules/data-export/service/exportService";

export async function POST(req: NextRequest) {
    const ctx = await getCurrentContext();
    if (!ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { entityType } = body;
    if (!entityType) return NextResponse.json({ error: "entityType required" }, { status: 400 });

    const json = await exportService.generateJson(entityType, ctx.teamId);
    return NextResponse.json({ json: JSON.parse(json) });
}
