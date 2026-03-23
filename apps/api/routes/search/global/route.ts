import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { SearchService } from "@/modules/search/service/SearchService";

export async function GET(req: NextRequest) {
    const ctx = await getCurrentContext();
    if (!ctx.teamId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q");

    if (!query) {
        return NextResponse.json({ success: true, data: { leads: [], campaigns: [], workflows: [], knowledge: [] } });
    }

    try {
        const results = await SearchService.globalSearch(ctx.teamId, query);
        return NextResponse.json({ success: true, data: results });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
