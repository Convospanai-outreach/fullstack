import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { schedulerService } from "@/modules/scheduler/schedulerService";

function isAuthorized(authHeader: string | null, secret: string): boolean {
    const expected = `Bearer ${secret}`;
    const expectedBuffer = Buffer.from(expected);
    const actualBuffer = Buffer.from(authHeader || "");
    return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

export async function POST(req: NextRequest) {
    // Simple security check
    const authHeader = req.headers.get("authorization");
    const secret = process.env['CRON_SECRET'];
    if (!secret) {
        return new NextResponse("Unauthorized", { status: 401 });
    }
    if (!isAuthorized(authHeader, secret)) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    try {
        const results = await schedulerService.processDueSchedules();
        return NextResponse.json({ success: true, processed: results.length, results });
    } catch (error: unknown) {
        console.error("Scheduler Trace Failed:", error);
        return new NextResponse((error as Error).message || "Internal Server Error", { status: 500 });
    }
}
