import { NextResponse } from "next/server";
import { checkAdmin } from "@/lib/admin";
import { AiStatsService } from "@/modules/ai/aiStatsService";
import { logger } from "@/lib/logger";

export async function GET() {
    const isAdmin = await checkAdmin();
    if (!isAdmin) {
        return new NextResponse("Unauthorized", { status: 403 });
    }

    try {
        const stats = await AiStatsService.getPerformanceMetrics();

        return NextResponse.json({
            success: true,
            stats,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        logger.error("[Admin API] Failed to fetch LLM stats", { error: errorMessage });
        return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
    }
}
