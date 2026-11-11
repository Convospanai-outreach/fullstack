import { NextResponse } from "next/server";
import { analyticsService } from "../service/analyticsService";
import { internalErrorMessage } from "@/lib/internalError";

export async function GET() {
    try {
        const stats = await analyticsService.getStats();
        return NextResponse.json({ ok: true, stats });
    } catch (err: any) {
        return NextResponse.json(
            { ok: false, error: internalErrorMessage(err) },
            { status: 500 }
        );
    }
}
