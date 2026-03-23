import { NextResponse } from "next/server";
import { analyticsService } from "../service/analyticsService";

export async function GET() {
    try {
        const stats = await analyticsService.getStats();
        return NextResponse.json({ ok: true, stats });
    } catch (err: any) {
        return NextResponse.json(
            { ok: false, error: err.message },
            { status: 500 }
        );
    }
}
