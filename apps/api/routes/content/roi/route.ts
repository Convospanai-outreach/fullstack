import { NextRequest, NextResponse } from "next/server";
import { contentError, creatorContext } from "@/modules/creator-funnel/contentRoutes";

const WINDOWS = new Set([7, 30, 90]);

// Content ROI report (contentRoi.ts): per published post, visits, opt-ins, purchases and revenue,
// plus funnel stage conversion, over the last 7, 30 (default) or 90 days.
export async function GET(req: NextRequest) {
    try {
        const ctx = await creatorContext(req, "read");
        if (ctx instanceof NextResponse) return ctx;
        const requested = Number(new URL(req.url).searchParams.get("days"));
        const days = WINDOWS.has(requested) ? requested : 30;
        const { getContentRoi } = await import("@/modules/creator-funnel/contentRoi");
        return NextResponse.json(await getContentRoi(ctx.teamId, days));
    } catch (error) {
        return contentError(error);
    }
}
