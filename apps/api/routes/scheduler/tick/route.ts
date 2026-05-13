import { NextRequest, NextResponse } from "next/server";
import { schedulerService } from "@/modules/scheduler/schedulerService";

export async function POST(req: NextRequest) {
    // Simple security check
    const authHeader = req.headers.get("authorization");
    const secret = process.env['CRON_SECRET'];
    if (!secret) {
        return new NextResponse("Unauthorized", { status: 401 });
    }
    if (authHeader !== `Bearer ${secret}`) {
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
